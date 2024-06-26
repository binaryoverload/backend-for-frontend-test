import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { fastifySwagger } from '@fastify/swagger';
import { conf, version } from '@/config';
import { isStatusError } from '@/utils/error';
import { logger } from '../log';
import { setupRoutes } from './routes';

const log = logger.child({ svc: 'fastify' });

export async function setupFastify(): Promise<FastifyInstance> {
  log.info(`setting up fastify...`);

  const app = Fastify({
    logger: log.child({ type: 'req' }) as any,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Poster',
        description: 'API server of poster',
        version,
      },
      servers: [
        {
          url: 'http://localhost:8080',
          description: 'Development server',
        },
      ],
    },
    transform: jsonSchemaTransform,
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      void reply.status(400).send({
        errorType: 'validation',
        errors: err.errors,
      });
      return;
    }

    if (isStatusError(err)) {
      void reply.status(err.errorStatusCode).send({
        errorType: 'message',
        message: err.message,
      });
      return;
    }

    log.error('unhandled exception on server:', err);
    log.error(err.stack);
    void reply.status(500).send({
      errorType: 'message',
      message: 'Internal server error',
      ...(conf.logging.debug
        ? {
            trace: err.stack,
            // eslint-disable-next-line @typescript-eslint/no-base-to-string -- error needs to be stringified
            errorMessage: err.toString(),
          }
        : {}),
    });
  });

  // plugins
  log.info(`setting up plugins`);
  await app.register(cors, {
    origin: '*',
  });

  return app;
}

export function startFastify(app: FastifyInstance) {
  // listen to port
  log.info(`listening to port`);
  return new Promise<void>((resolve) => {
    app.listen(
      {
        port: conf.server.port,
        host: '0.0.0.0',
      },
      (err: any) => {
        if (err) {
          app.log.error(err);
          log.error(`Failed to setup fastify`);
          process.exit(1);
        }
        log.info(`fastify setup successfully`);
        resolve();
      },
    );
  });
}

export async function setupFastifyRoutes(app: FastifyInstance) {
  log.info(`setting up routes`);
  await app.register(
    async (api) => {
      await setupRoutes(api);
      app.route({
        url: '/swagger',
        method: 'GET',
        handler: (req, res) => {
          return res.send(app.swagger());
        },
      });
    },
    {
      prefix: conf.server.basePath,
    },
  );
}
