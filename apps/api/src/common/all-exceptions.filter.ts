import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/node";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: "Internal server error" };

    Sentry.captureException(exception);
    const exceptionDetails =
      exception instanceof Error
        ? {
            name: exception.name,
            message: exception.message,
            stack: exception.stack
          }
        : { value: String(exception) };
    this.logger.error(
      JSON.stringify({
        requestId: request.requestId,
        method: request.method,
        url: request.url,
        status,
        exception: exceptionDetails
      })
    );

    response.status(status).json({
      requestId: request.requestId,
      error: payload
    });
  }
}
