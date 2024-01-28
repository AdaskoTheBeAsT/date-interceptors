# Date interceptors

## What problem does this set of libraries solve?

Dates in JSON are usually serialized as strings. This library helps to convert them to Date objects. It also helps to convert duration strings to Duration objects.

## Badges

[![CodeFactor](https://www.codefactor.io/repository/github/adaskothebeast/date-interceptors/badge)](https://www.codefactor.io/repository/github/adaskothebeast/date-interceptors)
[![Build Status](https://img.shields.io/azure-devops/build/AdaskoTheBeAsT/date-interceptors/23)](https://img.shields.io/azure-devops/build/AdaskoTheBeAsT/date-interceptors/23)
![Azure DevOps tests](https://img.shields.io/azure-devops/tests/AdaskoTheBeAsT/date-interceptors/23)
![Azure DevOps coverage](https://img.shields.io/azure-devops/coverage/AdaskoTheBeAsT/date-interceptors/23?style=plastic)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=AdaskoTheBeAsT_date-interceptors&metric=alert_status)](https://sonarcloud.io/dashboard?id=AdaskoTheBeAsT_date-interceptors)
![Sonar Tests](https://img.shields.io/sonar/tests/AdaskoTheBeAsT_date-interceptors?server=https%3A%2F%2Fsonarcloud.io)
![Sonar Test Count](https://img.shields.io/sonar/total_tests/AdaskoTheBeAsT_date-interceptors?server=https%3A%2F%2Fsonarcloud.io)
![Sonar Test Execution Time](https://img.shields.io/sonar/test_execution_time/AdaskoTheBeAsT_date-interceptors?server=https%3A%2F%2Fsonarcloud.io)
![Sonar Coverage](https://img.shields.io/sonar/coverage/AdaskoTheBeAsT_date-interceptors?server=https%3A%2F%2Fsonarcloud.io&style=plastic)
![NPM Downloads @adaskothebeast/angular-date-http-interceptor](https://img.shields.io/npm/dt/%40adaskothebeast%2Fangular-date-http-interceptor?label=download%20%40adaskothebeast%2Fangular-date-http-interceptor)
![NPM Downloads @adaskothebeast/axios-interceptor](https://img.shields.io/npm/dt/%40adaskothebeast%2Faxios-interceptor?label=download%20%40adaskothebeast%2Faxios-interceptor)
![NPM Downloads @adaskothebeast/hierarchical-convert-to-date](https://img.shields.io/npm/dt/%40adaskothebeast%2Fhierarchical-convert-to-date?label=download%20%40adaskothebeast%2Fhierarchical-convert-to-date)
![NPM Downloads @adaskothebeast/hierarchical-convert-to-date-fns](https://img.shields.io/npm/dt/%40adaskothebeast%2Fhierarchical-convert-to-date-fns?label=download%20%40adaskothebeast%2Fhierarchical-convert-to-date-fns)
![NPM Downloads @adaskothebeast/hierarchical-convert-to-dayjs](https://img.shields.io/npm/dt/%40adaskothebeast%2Fhierarchical-convert-to-dayjs?label=download%20%40adaskothebeast%2Fhierarchical-convert-to-dayjs)
![NPM Downloads @adaskothebeast/hierarchical-convert-to-js-joda](https://img.shields.io/npm/dt/%40adaskothebeast%2Fhierarchical-convert-to-js-joda?label=download%20%40adaskothebeast%2Fhierarchical-convert-to-js-joda)
![NPM Downloads @adaskothebeast/hierarchical-convert-to-luxon](https://img.shields.io/npm/dt/%40adaskothebeast%2Fhierarchical-convert-to-luxon?label=download%20%40adaskothebeast%2Fhierarchical-convert-to-luxon)
![NPM Downloads @adaskothebeast/hierarchical-convert-to-moment](https://img.shields.io/npm/dt/%40adaskothebeast%2Fhierarchical-convert-to-moment?label=download%20%40adaskothebeast%2Fhierarchical-convert-to-moment)
![NPM Downloads @adaskothebeast/react-redux-toolkit-hierarchical-date-hook](https://img.shields.io/npm/dt/%40adaskothebeast%2Freact-redux-toolkit-hierarchical-date-hook?label=download%20%40adaskothebeast%2Freact-redux-toolkit-hierarchical-date-hook)


## Which libraries are supported?

Helpers are prepared for following libraries:

- pure js Date object
- [date-fns](https://date-fns.org/) - Date and Duration objects
- [Day.js](https://day.js.org/) - Dayjs and Duration object
- [js-joda](https://js-joda.github.io/js-joda/) - ZonedDateTime object
- [luxon](https://moment.github.io/luxon/#/?id=luxon) - DateTime and Duration object
- [moment.js](https://momentjs.com/) - Moment and Duration object

## What frameworks are supported?

- [Angular](https://angular.io/) in form of [interceptor](https://angular.io/guide/http#intercepting-requests-and-responses) named ```HierarchicalDateHttpInterceptor```
- [react](https://reactjs.org/) all api call libraries are supported - special case for [rtk-query](https://redux-toolkit.js.org/rtk-query/overview) is solved in form of hook ```useAdjustUseQueryHookResultWithHierarchicalDateConverter```

## Installation dependant of date library

Based on your needs, install one of the following packages:

```ts
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
```

```ts
import { hierarchicalConvertToDateFns } from '@adaskothebeast/hierarchical-convert-to-date-fns';
```

```ts
import { hierarchicalConvertToDayjs } from '@adaskothebeast/hierarchical-convert-to-dayjs';
```

```ts
import { hierarchicalConvertToJsJoda } from '@adaskothebeast/hierarchical-convert-to-js-joda';
```

```ts
 import { hierarchicalConvertToLuxon } from '@adaskothebeast/hierarchical-convert-to-luxon';
```

```ts
import { hierarchicalConvertToMoment } from '@adaskothebeast/hierarchical-convert-to-moment';
```

## Installation dependant of framework

Additionally in some cases you need to install framework specific package:

### Angular

In your application's root module, import library module and symbol and provide the `hierarchicalConvertToDate` or other function using the HIERARCHICAL_DATE_ADJUST_FUNCTION token:

```ts
import { AngularDateHttpInterceptorModule, HIERARCHICAL_DATE_ADJUST_FUNCTION } from '@adaskothebeast/angular-date-http-interceptor';

// Adjust this import as needed - this will import adjustment function for pure js Date object
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';

@NgModule({
  imports: [
    // ...
    AngularDateHttpInterceptorModule,
  ],
  providers: [
    { provide: HIERARCHICAL_DATE_ADJUST_FUNCTION, useValue: hierarchicalConvertToDate },
    // other providers...
  ]
})
export class AppModule { }
```

In this setup, Angular's dependency injection system will provide the `hierarchicalConvertToDate` function to the `HierarchicalDateHttpInterceptor` when it's instantiated, even though the function is provided in the application's module and the interceptor is provided in the library module. This is because Angular's DI system is hierarchical and can inject dependencies from parent injectors into child injectors.

### React

In case of react there are multiple libraries that can be used for api calls. For one of it there is special hook prepared:

#### rtk-query

Hook `useAdjustUseQueryHookResultWithHierarchicalDateConverter` must be called within a React component or another custom hook, and the `useQueryFunction` argument it receives should be a hook that has already been invoked.

You would then use it in a component like this:

```ts
import { useAdjustUseQueryHookResultWithHierarchicalDateConverter} from '@adaskothebeast/react-date-query-hook';

const MyComponent: React.FC = () => {
  const useQueryResult = useQueryFunction(arg, options);  // <-- Call your hook here
  const adjustedQueryResult = useAdjustUseQueryHookResultWithHierarchicalDateConverter(useQueryResult); // <-- Pass the result to your custom hook

  // Rest of your component...
}
```

This would adhere to the rules of Hooks, as the hook is being called at the top level of a React function component, not inside a callback or other function.

#### redux-query-react

To create a custom React hook that uses the `hierarchicalConvertToDate` function in combination with Redux Query, we first need to define how `redux-query` is set up in your application. For simplicity, let's assume that you are using `useRequest` or `useMutation` hooks provided by `redux-query-react`.

We can create a custom hook named `useParsedRequest` that takes the same parameters as `useRequest` and uses `hierarchicalConvertToDate` to parse any date strings in the response data into `Date` objects.

Here's a possible implementation in TypeScript:

```ts
import { useRequest, RequestConfig } from 'redux-query-react';
import { useMemo } from 'react';

// Adjust this import as needed - this will import adjustment function for pure js Date object
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';

export function useParsedRequest(config: RequestConfig) {
  const { url, ...restConfig } = config;

  const transformedConfig: RequestConfig = useMemo(() => ({
    ...restConfig,
    url,
    transform: (data: any) => {
      hierarchicalConvertToDate(data);
      return restConfig.transform ? restConfig.transform(data) : data;
    },
  }), [url, restConfig]);

  return useRequest(transformedConfig);
}

```

In this example, we first destructure the `config` parameter to separate the `url` and `restConfig`. This is because we'll only be changing the `transform` function and we want to make sure our `useMemo` dependency array doesn't change too often.

We then define `transformedConfig` using `useMemo` to create a new config object that includes our `hierarchicalConvertToDate` call inside the `transform` function. We're still calling the original transform function if it was provided.

Finally, we call `useRequest` with our `transformedConfig` and return the result.

You can use `useParsedRequest` just like you would use `useRequest`, but the response data will be passed through `hierarchicalConvertToDate` before being returned.

Remember to adjust the import paths and the `hierarchicalConvertToDate` function to match your project structure and requirements.

#### react-query

To use the `hierarchicalConvertToDate` function within the context of `react-query`, you can incorporate it within the fetcher function that you pass to `react-query`'s `useQuery` hook.

Here's a sample implementation:

```ts
import { useQuery } from 'react-query';

// Adjust this import as needed - this will import adjustment function for pure js Date object
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';

// Fetcher function that retrieves data and applies date parsing
async function fetcher(url: string) {
  const response = await fetch(url);
  const data = await response.json();
  hierarchicalConvertToDate(data);
  return data;
}

function MyComponent() {
  const { data, isLoading, error } = useQuery('myKey', () => fetcher('/api/my-endpoint'));

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error occurred</div>;
  }

  return (
    <div>
      {/* Render data here */}
    </div>
  );
}

```

In the code above, we defined an asynchronous `fetcher` function that retrieves data from an API endpoint, applies the `hierarchicalConvertToDate` function to the retrieved data, and then returns the parsed data. This `fetcher` function is then passed to the `useQuery` hook from `react-query`. The results (data, loading state, and error state) are then used in `MyComponent` to display the appropriate UI based on the state of the data fetch.

#### redux-saga

In order to perform this task with `redux-saga`, you would need to define a saga that fetches the data, parses the dates, and then dispatches a success action with the parsed data as its payload.

Here's a general example of how you could structure this:

```ts
import { call, put, takeEvery } from 'redux-saga/effects';
import axios from 'axios';

// Adjust this import as needed - this will import adjustment function for pure js Date object
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';

// Saga worker
function* fetchData(action) {
  try {
    const response = yield call(axios.get, action.payload.url);
    hierarchicalConvertToDate(response.data);
    yield put({ type: 'FETCH_SUCCEEDED', payload: response.data });
  } catch (e) {
    yield put({ type: 'FETCH_FAILED', message: e.message });
  }
}

// Saga watcher
function* watchFetchData() {
  yield takeEvery('FETCH_REQUESTED', fetchData);
}

// Export the saga (single or root)
export default function* rootSaga() {
  yield all([watchFetchData()]);
}
```

This code consists of two parts. The `fetchData` generator function (the "worker" saga) performs the asynchronous fetch operation when a `FETCH_REQUESTED` action is dispatched. It then uses the `call` effect to perform the API call with `axios.get`, applies the `hierarchicalConvertToDate` function to the response data, and then dispatches a `FETCH_SUCCEEDED` action with the parsed data. If an error occurs during this process, it dispatches a `FETCH_FAILED` action with the error message.

The `watchFetchData` generator function (the "watcher" saga) waits for `FETCH_REQUESTED` actions to be dispatched, and then triggers the `fetchData` worker saga each time this happens.

In your React component, you would dispatch a `FETCH_REQUESTED` action to initiate this process. For example:

```ts
import { useDispatch } from 'react-redux';

function MyComponent() {
  const dispatch = useDispatch();

  const fetchData = () => {
    dispatch({ type: 'FETCH_REQUESTED', payload: { url: '/api/my-endpoint' } });
  };

  // Call fetchData() at the appropriate time (e.g. in a useEffect or in response to user interaction)
}
```

Remember to integrate the saga with your store using the `redux-saga` middleware. The exact setup will depend on your application structure and configuration.

Please adjust the code according to your requirements.

#### SWR

In order to use the `hierarchicalConvertToDate` function within the context of `swr` (Stale While Revalidate), you can incorporate it within the `fetcher` function that you pass to `swr`'s useSWR hook.

Here's a sample implementation:

```ts
import useSWR from 'swr';

// Adjust this import as needed - this will import adjustment function for pure js Date object
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';

// Fetcher function that retrieves data and applies date parsing
async function fetcher(url: string) {
  const response = await fetch(url);
  const data = await response.json();
  hierarchicalConvertToDate(data);
  return data;
}

function MyComponent() {
  const { data, error } = useSWR('/api/my-endpoint', fetcher);

  if (error) {
    return <div>Error occurred</div>;
  }

  if (!data) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {/* Render data here */}
    </div>
  );
}
```

In the code above, we defined an asynchronous `fetcher` function that retrieves data from an API endpoint, applies the `hierarchicalConvertToDate` function to the retrieved data, and then returns the parsed data. This `fetcher` function is then passed to the `useSWR` hook from `swr`. The results (data and error state) are then used in `MyComponent` to display the appropriate UI based on the state of the data fetch.

Please adjust the code according to your project structure and requirements.

#### redux-thunk

When using `redux-thunk`, you'll dispatch a function (the "thunk") that performs the asynchronous request and dispatches actions to represent the lifecycle of the request.

We'll create a function which represents the asynchronous operation:

```ts
// Adjust this import as needed - this will import adjustment function for pure js Date object
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';


function fetchApiData(url: string) {
  return async function(dispatch: Function) {
    dispatch({ type: 'FETCH_DATA_REQUEST' });

    try {
      const response = await fetch(url);
      const data = await response.json();

      hierarchicalConvertToDate(data);  // Apply the date adjustment

      dispatch({ type: 'FETCH_DATA_SUCCESS', payload: data });
    } catch (error) {
      dispatch({ type: 'FETCH_DATA_FAILURE', payload: error.message });
    }
  };
}
```

In this function, `FETCH_DATA_REQUEST`, `FETCH_DATA_SUCCESS`, and `FETCH_DATA_FAILURE` are action types that your reducer should handle.

In your component, you can dispatch this function like so:

```ts
import { useDispatch } from 'react-redux';

function MyComponent() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchApiData('/api/my-endpoint'));
  }, [dispatch]);

  // Rest of your component here...
}
```

This will initiate the fetch when your component mounts and dispatch either a success or failure action when the fetch completes, allowing you to store the fetched data (or any error that occurred) in your Redux state.

Please adjust the code according to your requirements and project structure.

### Axios with AxiosInstanceManager

The AxiosInstanceManager class simplifies the process of using Axios with the `hierarchicalConvertToDate` function. By utilizing this class, you can easily create and use a centralized Axios instance with a response interceptor that automatically processes response data.

Here's how to use AxiosInstanceManager:

```ts
import { AxiosInstanceManager } from '@adaskothebeast/axios-interceptor';
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';

// Create an Axios instance using AxiosInstanceManager
const instance = AxiosInstanceManager.createInstance(hierarchicalConvertToDate);

async function fetchApiData() {
  try {
    const response = await instance.get('/api/my-endpoint');
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
}

fetchApiData();
```

In the code above:

- The createInstance method of AxiosInstanceManager is used to create and configure an Axios instance. This instance is configured with a response interceptor that applies hierarchicalConvertToDate to response.data. This conversion function processes any date strings in the response data into JavaScript Date objects (or in case of other libs proper class for given date lib).
- The fetchApiData function demonstrates using the configured Axios instance to make a GET request. The response data, with date strings already converted into Date (or in case of other libs proper class for given date lib) objects, is logged to the console. Errors from the request are caught and logged.

This approach encapsulates the Axios configuration, making your code cleaner and more maintainable. Remember to adjust imports and function calls as per your project's file structure and requirements.
