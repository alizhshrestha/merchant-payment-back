import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import Joi from 'joi';

export interface LoginInput {
  email: string;
  password: string;
}
const schema = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(255)
    .required(),
  password: Joi.string().min(1).max(256).required(),
})
  .required()
  .unknown(false);

@Injectable()
export class LoginPipe implements PipeTransform<unknown, LoginInput> {
  transform(value: unknown): LoginInput {
    const result = schema.validate(value, { abortEarly: false });
    if (result.error)
      throw new BadRequestException('Provide a valid email and password only');
    return result.value as LoginInput;
  }
}
