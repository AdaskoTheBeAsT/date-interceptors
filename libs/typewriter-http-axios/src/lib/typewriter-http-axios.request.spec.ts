import { schema } from '@adaskothebeast/typewriter-schema';
import axios from 'axios';

import { installTypewriterAxiosRequestInterceptor } from './typewriter-http-axios';

describe('installTypewriterAxiosRequestInterceptor without a body', () => {
  it('leaves bodiless requests untouched even when a request schema is set', async () => {
    const instance = axios.create();
    installTypewriterAxiosRequestInterceptor(instance);
    let sent: unknown = 'not called';
    instance.defaults.adapter = async (config) => {
      sent = config.data;
      return { config, status: 200, statusText: 'OK', headers: {}, data: {} };
    };
    await instance.get('/bodiless', {
      requestSchema: schema.object({
        amount: schema.property(schema.decimal('string')),
      }),
    });
    expect(sent).toBeUndefined();
  });
});
