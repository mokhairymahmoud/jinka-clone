import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { trace } from "@opentelemetry/api";
import { randomUUID } from "node:crypto";
import { Observable } from "rxjs";
import { finalize } from "rxjs/operators";

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const tracer = trace.getTracer("jinka-eg-api");
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const requestId = request.headers["x-request-id"]?.toString() ?? randomUUID();
    const startedAt = Date.now();
    const span = tracer.startSpan(`${request.method} ${request.url}`);

    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Date.now() - startedAt;

        span.setAttribute("http.method", request.method);
        span.setAttribute("http.route", request.url);
        span.setAttribute("http.status_code", response.statusCode);
        span.end();

        this.logger.log(
          JSON.stringify({
            requestId,
            method: request.method,
            url: request.url,
            statusCode: response.statusCode,
            durationMs
          })
        );
      })
    );
  }
}
