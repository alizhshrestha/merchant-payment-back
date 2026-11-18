import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import Joi from 'joi';
import { ApplicationStatus } from '../database/entities/merchant-application.entity';

export interface CreateApplicationInput {
  businessName: string;
  legalBusinessName: string;
  businessType: string;
  ownerName: string;
  contactEmail: string;
  contactPhone?: string | null;
  requestedMonthlyVolume: string;
  currency: string;
}
export type UpdateApplicationInput = Partial<CreateApplicationInput>;
export interface ApplicationListInput {
  page: number;
  limit: number;
  status?: ApplicationStatus;
}

const fields = {
  businessName: Joi.string().trim().min(1).max(200),
  legalBusinessName: Joi.string().trim().min(1).max(200),
  businessType: Joi.string().trim().min(1).max(100),
  ownerName: Joi.string().trim().min(1).max(150),
  contactEmail: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(255),
  contactPhone: Joi.string().trim().min(1).max(30).allow(null),
  // Accept decimal strings only: no floating-point rounding, exponent, sign or NaN.
  requestedMonthlyVolume: Joi.string().pattern(
    /^(0|[1-9]\d{0,12})(\.\d{1,2})?$/,
  ),
  currency: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z]{3}$/),
};
const required = Object.keys(fields).filter((key) => key !== 'contactPhone');
const createSchema = Joi.object(fields)
  .fork(required, (field) => field.required())
  .unknown(false)
  .required();
const updateSchema = Joi.object(fields).min(1).unknown(false).required();
const listSchema = Joi.object({
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...Object.values(ApplicationStatus)),
})
  .unknown(false)
  .required();

function validate<T>(schema: Joi.ObjectSchema, value: unknown): T {
  const result = schema.validate(value, { abortEarly: false });
  if (result.error)
    throw new BadRequestException(
      result.error.details.map((detail) => detail.message),
    );
  return result.value as T;
}

@Injectable()
export class CreateApplicationPipe implements PipeTransform<
  unknown,
  CreateApplicationInput
> {
  transform(value: unknown) {
    return validate<CreateApplicationInput>(createSchema, value);
  }
}
@Injectable()
export class UpdateApplicationPipe implements PipeTransform<
  unknown,
  UpdateApplicationInput
> {
  transform(value: unknown) {
    return validate<UpdateApplicationInput>(updateSchema, value);
  }
}
@Injectable()
export class ApplicationListPipe implements PipeTransform<
  unknown,
  ApplicationListInput
> {
  transform(value: unknown) {
    return validate<ApplicationListInput>(listSchema, value);
  }
}
