import Joi from 'joi';

// A 32-byte randomly generated secret, encoded as exactly 64 hexadecimal characters.
export const authEnvironmentSchema = Joi.object({
  JWT_SECRET: Joi.string()
    .pattern(/^[a-fA-F0-9]{64}$/)
    .required(),
});
