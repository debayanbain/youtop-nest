import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | object = 'Internal server error';
    if (exception instanceof HttpException) {
      const errorResponse = exception.getResponse();
      message = typeof errorResponse === 'object' ? errorResponse : { message: errorResponse };
    }

    const errorDetails = exception instanceof Error ? exception.stack : JSON.stringify(exception);

    // Only log 5xx as error. Keep 4xx as warnings.
    if (status >= 500) {
      this.logger.error(
        `[500 Internal Error] ${request.method} ${request.url}\nStack: ${errorDetails}`,
      );
    } else {
      this.logger.warn(
        `[${status} Request Error] ${request.method} ${request.url} - Msg: ${
          typeof message === 'object' ? JSON.stringify(message) : message
        }`,
      );
    }

    const payloadMsg = typeof message === 'object' && 'message' in message
      ? (message as any).message
      : message;

    response.status(status).json({
      success: false,
      statusCode: status,
      message: payloadMsg,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
