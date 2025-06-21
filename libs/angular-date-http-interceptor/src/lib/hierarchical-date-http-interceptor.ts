import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { HIERARCHICAL_DATE_ADJUST_FUNCTION } from './hierarchical-date-adjust-symbol';

/**
 * HttpInterceptor that converts ISO 8601 date strings to Date objects in the response body.
 *
 * ```ts
 * import { HIERARCHICAL_DATE_ADJUST_FUNCTION } from 'my-library'; // Adjust this import as needed
 *  // choose one function from below depending on library which you use for date manipulation
 *  import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
 *  import { hierarchicalConvertToDateFns } from '@adaskothebeast/hierarchical-convert-to-date-fns';
 *  import { hierarchicalConvertToDayjs } from '@adaskothebeast/hierarchical-convert-to-dayjs';
 *  import { hierarchicalConvertToJsJoda } from '@adaskothebeast/hierarchical-convert-to-js-joda';
 *  import { hierarchicalConvertToLuxon } from '@adaskothebeast/hierarchical-convert-to-luxon';
 *  import { hierarchicalConvertToMoment } from '@adaskothebeast/hierarchical-convert-to-moment';
 *
 * @NgModule({
 *   imports: [
 *     // ...
 *     MyLibraryModule,
 *   ],
 *   providers: [
 *     { provide: HIERARCHICAL_DATE_ADJUST_FUNCTION, useValue: hierarchicalConvertToDate },
 *     // other providers...
 *   ]
 * })
 * export class AppModule { }
 * ```
 */
@Injectable()
export class HierarchicalDateHttpInterceptor implements HttpInterceptor {
  private readonly adjustDates: (obj: unknown) => void;
  constructor() {
    this.adjustDates = inject(HIERARCHICAL_DATE_ADJUST_FUNCTION);
  }

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      map((event: HttpEvent<unknown>) => {
        if (event instanceof HttpResponse) {
          this.adjustDates(event.body);
        }
        return event;
      }),
    );
  }
}
