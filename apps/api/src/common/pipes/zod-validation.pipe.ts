import { ApiException } from '../errors/api-exception';
import { HttpStatus, type PipeTransform } from '@nestjs/common';

/**
 * Structural subset of a Zod schema. Used instead of importing zod directly so
 * the runtime zod instance stays owned by @abs/contracts.
 */
export interface ZodLikeSchema<T> {
  safeParse(
    data: unknown,
  ):
    | { success: true; data: T }
    | {
        success: false;
        error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } };
      };
}

/**
 * Validates route input against a @abs/contracts Zod schema.
 * Throws VALIDATION_ERROR (400) with flattened field errors on failure.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodLikeSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ApiException(
        'VALIDATION_ERROR',
        HttpStatus.BAD_REQUEST,
        'Validation failed',
        { fieldErrors: result.error.flatten().fieldErrors },
      );
    }
    return result.data;
  }
}
