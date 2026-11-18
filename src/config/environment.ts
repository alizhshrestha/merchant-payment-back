import Joi from 'joi';

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().min(1).default(3000),
  POSTGRES_HOST: Joi.string().trim().required(),
  POSTGRES_PORT: Joi.number().port().min(1).required(),
  POSTGRES_USER: Joi.string().trim().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().trim().required(),
});
