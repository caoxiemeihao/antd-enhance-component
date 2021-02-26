/**
 * ypRequest 一些类型补充
 */

export interface ResultStatus {
  success: boolean;
  code: number;
  message: string;
}

export interface Result extends ResultStatus {
  data?: any;
  list?: any;
  page?: number;
  size?: number;
  total?: number;
  isEnd?: boolean;
  pages?: number;
  [other: string]: any;
}

export interface ResponstResult<T = Result> {
  success: boolean;
  result: T;
  code: number;
  message: string;
}
