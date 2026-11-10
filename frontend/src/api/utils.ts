import { AxiosResponse } from 'axios'
import { axiosInstance } from '../utils/axios'

export const MAX_UPLOAD_FILE_SIZE = 2 * 1024 * 1024

export type EndpointOptions = {
  /** Request timeout in milliseconds. Defaults to axios' default (no timeout). */
  timeout?: number
}

export function endpoint<Output>(
  method: 'get' | 'delete' | 'post' | 'put' | 'patch',
  path: string,
  options?: EndpointOptions
): () => Promise<Output>
export function endpoint<Output, Input extends undefined>(
  method: 'get' | 'delete' | 'post' | 'put' | 'patch',
  path: string,
  options?: EndpointOptions
): (...args: Exclude<Input, undefined> extends never ? [] : [Input]) => Promise<Output>
export function endpoint<Output, Input>(
  method: 'get' | 'delete' | 'post' | 'put' | 'patch',
  path: string,
  options?: EndpointOptions
): (body: Input) => Promise<Output>
export function endpoint<Output, Input>(
  method: 'get' | 'delete' | 'post' | 'put' | 'patch',
  pathBuilder: (q: Input) => string,
  options?: EndpointOptions
): (body: Input) => Promise<Output>
export function endpoint<Output, Input>(
  method: 'get' | 'delete' | 'post' | 'put' | 'patch',
  urlBuilder: string | ((q: Input) => string),
  options: EndpointOptions = {}
): (body?: Input) => Promise<Output> {
  return async (body?: Input) => {
    const url = `${typeof urlBuilder === 'string' ? urlBuilder : urlBuilder(body!)}`

    let res: AxiosResponse
    if (method === 'get') {
      res = await axiosInstance[method](url, { params: body, ...options })
    } else {
      res = await axiosInstance.request({
        method,
        url,
        data: body,
        ...options,
      })
    }

    return res.data as Output
  }
}

export type ApiModule = {
  readonly [key: string]: ((...args: any[]) => Promise<any>) | ApiModule
}

export type ApiInput<T extends (...args: any[]) => Promise<any>> = Parameters<T>[0]
export type ApiOutput<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>
