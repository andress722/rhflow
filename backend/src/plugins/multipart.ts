import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';

export default fp(async (fastify) => {
  await fastify.register(multipart, {
    limits: {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 1000000, // Max field value size in bytes (1MB)
      fields: 10,         // Max number of non-file fields
      fileSize: 5242880,  // Max file size in bytes (5MB)
      files: 1,           // Max number of file fields
    },
  });
});
