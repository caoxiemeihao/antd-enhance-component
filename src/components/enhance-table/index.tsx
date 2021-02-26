/**
 * 扩展 Antd Table
 */
import React, {
  useEffect,
  useState,
  useContext,
  useRef,
  useImperativeHandle,
  MutableRefObject,
} from 'react';
import { Input, Select, DatePicker, Table } from 'antd';
import { TableProps, TablePaginationConfig, ColumnType } from 'antd/es/table';
import { SorterResult, TableCurrentDataSource } from 'antd/es/table/interface';
import Form, { FormInstance, FormItemProps } from 'antd/es/form';
import { Moment } from 'moment';
import ypRequest from '../ypRequest';
import { ResponstResult, Result } from './request';
import { useUpDownForInput } from './hooks';

export interface OptionsItem extends Record<string, any> {
  label: string;
  value: string | number;
}

export interface CellChangeArgs<RecordType = Record<string, any>> {
  value: OnEditChangeValue;
  form: FormInstance<Record<string, any>>;
  dataIndex: string;
  record: RecordType;
  rowIndex: number;
  colIndex: number;
  event: any;
}

export type EDIT_TYPE = 'INPUT' | 'SELECT' | 'DATE_PICKER';

export type HookCmd = 'rules' | 'initialValue';

/** ColumnType 扩展 */
export interface ColumnTypeExt<RecordType extends Record<string, any>>
  extends ColumnType<RecordType> {
  edit?: EDIT_TYPE | ((txt: any, record: RecordType, rowIndex: number) => EDIT_TYPE);
  options?:
    | Array<OptionsItem>
    | ((txt: any, record: RecordType, rowIndex: number) => Array<OptionsItem>);
  onEdit?: (arg0: CellChangeArgs<RecordType>) => void;
  disabled?: boolean | ((txt: any, record: RecordType, rowIndex: number) => boolean);
  /** 提供一些能力 */
  hook?: (arg0: {
    cmd: HookCmd;
    record: RecordType;
    dataIndex: string;
    rowIndex: number;
    colIndex: number;
    form: FormInstance<Record<string, any>>;
    payload: any;
  }) => any; // 返回 payload
}

export interface HandleType<RecordType extends Record<string, any>> {
  dataSource: Array<RecordType> | undefined;
  pagination: TablePaginationConfig;
  reload: (pagination?: TablePaginationConfig) => void;
  form: FormInstance<RecordType>;
}

export interface EnhanceTableProps<RecordType extends Record<string, string>>
  extends TableProps<RecordType> {
  /** 扩展可编辑配置 */
  columns: Array<ColumnTypeExt<RecordType>>;
  /** 请求信息 */
  query?: {
    /** 请求地址 */
    url: string;
    /** 请求参数 */
    params?: Record<string, any>;
    /** 是否自动请求 */
    auto?: boolean;
  };
  /** 请求之前干点儿啥，返回值会当作请求参数，返回 false 取消请求 */
  onRequest?: (arg0: {
    url: string;
    params: Record<string, any>;
    changArgs: [
      TablePaginationConfig,
      Record<string, React.Key[] | null>,
      SorterResult<RecordType> | SorterResult<RecordType>[],
      TableCurrentDataSource<RecordType>,
    ];
  }) => Record<string, any> | false | Promise<Record<string, any>> | Promise<false>;
  /** 请求之后干点儿啥 */
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  onResponse?: (arg0: ResponstResult<Result>) => ResponstResult<Result> | void;
  /** 表格数据刷新之后干点儿啥 */
  onDataSourceChange?: (dataSource?: Array<RecordType>) => void;
  /** 对外暴露功能 */
  handle?: MutableRefObject<HandleType<RecordType> | undefined>;
}

const EditableContext = React.createContext<FormInstance>({} as any);

// 覆写 tr
// const EditableRow = ({ index, ...props }: any) => {
//   const [form] = Form.useForm()
//   return (
//     <Form form={form} component={false}>
//       <EditableContext.Provider value={form}>
//         <tr {...props} />
//       </EditableContext.Provider>
//     </Form>
//   )
// }

export interface EditableCellProps<RecordType> extends React.HTMLAttributes<HTMLElement> {
  record: RecordType;
  rowIndex: number;
  colIndex: number;
  column: ColumnTypeExt<RecordType>;
  children: React.ReactNode;
}

export type OnEditChangeValue = string | number | Array<string | number> | null;

// 覆写 td
const EditableCell: React.FC<EditableCellProps<Record<string, any>>> = (props) => {
  const { column = {}, children, record, rowIndex, colIndex, ...ommited } = props;
  // 只有 editable 才会有 column，把所有东西放 column 里面维护清晰
  const { edit, dataIndex, options, onEdit, disabled, hook, title, render } = column;
  const form = useContext(EditableContext);

  const save = async (event: any, value: OnEditChangeValue) => {
    // 保留一份原始数据
    if (record[`${dataIndex}_old`] === undefined)
      record[`${dataIndex}_old`] = record[dataIndex as string];
    // 数据同步到编辑行
    record[dataIndex as string] = value;
    if (onEdit instanceof Function) {
      try {
        onEdit({
          value,
          form,
          dataIndex: dataIndex as string,
          record,
          rowIndex,
          colIndex,
          event,
        });
      } catch (error) {
        console.warn(error);
      }
    }
  };

  let childNode = children;

  if (edit) {
    const _options =
      (options instanceof Function
        ? options(record[dataIndex as string], record, rowIndex)
        : options) || [];
    const _disabled =
      disabled instanceof Function
        ? disabled(record[dataIndex as string], record, rowIndex)
        : disabled;
    const factory = {
      name: `${dataIndex}-${colIndex}-${rowIndex}`,
      class: (cls = '') => `${cls}-${dataIndex}-${colIndex}-${rowIndex}`,
      hook: (cmd: HookCmd, payload: any) =>
        hook instanceof Function
          ? hook({ cmd, payload, record, rowIndex, colIndex, dataIndex: dataIndex as string, form })
          : payload,
    };
    const rules = {
      input: (t = title) => [{ required: true, message: `请选择${t}` }],
      select: (t = title) => [{ required: true, message: `请输入${t}` }],
    };

    if (edit === 'INPUT') {
      childNode = (
        <Form.Item
          name={factory.name}
          initialValue={factory.hook('initialValue', record[dataIndex as string])}
          rules={factory.hook('rules', rules.input())}
        >
          <Input
            disabled={_disabled}
            onPressEnter={(ev) => (ev.target as HTMLInputElement).blur()}
            onBlur={(ev) => save(ev, ev.target.value)}
            autoComplete="off"
            className={factory.class('input')}
          />
        </Form.Item>
      );
    } else if (edit === 'SELECT') {
      childNode = (
        <Form.Item
          name={factory.name}
          initialValue={factory.hook('initialValue', record[dataIndex as string])}
          rules={factory.hook('rules', rules.select())}
        >
          <Select
            allowClear
            disabled={_disabled}
            onChange={(val) => save(val, val as any)}
            className={factory.class('select')}
          >
            {_options.map(({ label, value }, idx) => (
              <Select.Option key={idx} value={value}>
                {label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      );
    } else if (edit === 'DATE_PICKER') {
      childNode = (
        <Form.Item
          name={factory.name}
          initialValue={factory.hook('initialValue', record[dataIndex as string])}
          rules={factory.hook('rules', rules.select())}
        >
          <DatePicker
            allowClear
            disabled={_disabled}
            onChange={(mom: Moment | null) => save(mom, mom ? mom./* 时间戳 */ valueOf() : mom)}
            className={factory.class('datepicker')}
          />
        </Form.Item>
      );
    }
  }

  return (
    <td {...ommited}>
      {render instanceof Function && edit ? render(childNode, record, rowIndex) : childNode}
    </td>
  );
};

/**
 * 自定义表格
 * @param props 基于表格属性扩展了一增强
 */
function EnhanceTable<RecordType extends Record<string, any>>(
  props: EnhanceTableProps<RecordType>,
) {
  const {
    className,
    style,
    columns,
    pagination,
    dataSource: data,
    query,
    onRequest,
    onResponse,
    onDataSourceChange,
    onChange,
    handle,
    ...ommited
  } = props;

  const ref_tableWrap = useRef<HTMLDivElement>(null);
  const ref_auto = useRef<boolean | undefined>(query?.auto ?? true);
  const ref_isDidMount = useRef(false); // 是否是 componentDidMount
  const ref_page = useRef<TablePaginationConfig>({
    current: 1,
    pageSize: 30,
    total: 0,
    ...(pagination ? pagination : undefined),
  });
  const ref_timer = useRef<NodeJS.Timer>();
  const ref_changArgs = useRef<
    [
      TablePaginationConfig,
      Record<string, React.Key[] | null>,
      SorterResult<RecordType> | SorterResult<RecordType>[],
      TableCurrentDataSource<RecordType>,
    ]
  >([] as any);

  const [form] = Form.useForm();
  const [dataSource, setDataSource] = useState<Array<RecordType> | undefined>(data);
  const [total, setTotal] = useState<number>(0);
  const [_params, set_params] = useState<Record<string, any>>();
  const [loading, setLoading] = useState(false);
  const [setInputEventContainer] = useUpDownForInput();

  const tableProps: TableProps<RecordType> = {
    size: 'small',
    columns: columns.map((column, colIndex) =>
      column.edit
        ? {
            ...column,
            onCell: (record, rowIndex) => ({
              record,
              rowIndex,
              colIndex,
              column,
            }),
          }
        : column,
    ) as Array<ColumnType<RecordType>>,
    // dataSource 扩展 className
    onRow: (record, index) => ({ record, index, className: (record as any).className }),
    components: {
      body: {
        // row: EditableRow,
        cell: EditableCell,
      },
    },
    pagination:
      pagination === false
        ? false
        : {
            size: 'small',
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '30', '50', '100'],
            showTotal: (total: number) => `共计${total}条数据`,
            ...ref_page.current,
            total,
          },
    onChange(pagination, filters, sorter, extra) {
      // pagination 为 false 时这里得到 {}
      onChange instanceof Function && onChange(pagination, filters, sorter, extra);
      ref_changArgs.current = [pagination, filters, sorter, extra];
      queryHandle((ref_page.current = pagination));
    },
    loading,
    dataSource,
    rowKey: (_, i) => String(i),
    ...ommited,
  };

  // 加载前干点啥
  const _onRequest = async (url: string, params: any) => {
    let params2 = params;
    if (onRequest instanceof Function) {
      params2 = await onRequest({ url, params, changArgs: ref_changArgs.current });
    }
    if (params2) {
      setLoading(true);
    }
    return [params2]; // 考虑到后面可能多返回值
  };
  // 加载后干点啥
  const _onResponse = (res: ResponstResult) => {
    let _res = res;
    setLoading(false);

    if (onResponse instanceof Function) {
      try {
        // 交给调用处格式化数据
        _res = (onResponse(res) as ResponstResult) ?? res;
      } catch (error) {
        console.warn('调用处格式化数据 formatResult\n', error);
      }
    }
    return [_res]; // 考虑到后面可能多返回值
  };

  const queryHandle = async (
    pagination: TablePaginationConfig = ref_page.current as TablePaginationConfig,
  ) => {
    const { current, pageSize, total } = pagination;
    const { url, params } = query ?? {};

    if (url) {
      const [params2] = await _onRequest(url, params);
      // console.log(params2)
      if (params2 === false) {
        // console.log('主动取消请求', url)
        return;
      }
      const res = await ypRequest.post(url, {
        ...(pagination ? { page: current, size: pageSize } : undefined),
        ...params2,
      });
      const [res2] = _onResponse(res);
      const { success, result } = res2;

      if (success) {
        const { isEnd, total = 0, list: l, data: d } = result;
        const list: any = d ?? l ?? [];
        if (Array.isArray(list)) {
          setDataSource(list);
          setTotal((ref_page.current.total = +total));
        }
      }
    }
  };

  useImperativeHandle(
    handle,
    () => ({
      dataSource,
      pagination: ref_page.current as TablePaginationConfig,
      reload: queryHandle,
      form,
    }),
    [dataSource, ref_page.current],
  );

  useEffect(() => {
    if (!ref_auto.current) return; // 打断自动请求
    set_params({ ...query?.params });
    ref_page.current.current = 1; // 回到第一页
  }, [query?.params]);

  useEffect(() => {
    if (!ref_isDidMount.current) return; // 避开第一次自动执行
    if (ref_timer.current) clearTimeout(ref_timer.current);
    ref_timer.current = setTimeout(() => {
      // 防抖处理
      queryHandle();
    }, 200);
  }, [_params]);

  // 外部回填 dataSource
  useEffect(() => {
    if (ref_isDidMount.current) setDataSource(data);
  }, [data]);

  // dataSource 刷新事件
  useEffect(() => {
    if (onDataSourceChange instanceof Function) onDataSourceChange(dataSource);
  }, [dataSource]);

  // 这个当 componentDidMount 用，放在最后面
  useEffect(() => {
    ref_isDidMount.current = true;
    ref_auto.current = true; // 第一次运行后，将请求开放
    setInputEventContainer(ref_tableWrap.current);
  }, []);

  return (
    <div className={[className, 'enhance-table__wrap'].join(' ')} style={style} ref={ref_tableWrap}>
      <Form form={form} component={false}>
        <EditableContext.Provider value={form}>
          <Table {...(tableProps as any)} />
        </EditableContext.Provider>
      </Form>
    </div>
  );
}

export default EnhanceTable;
