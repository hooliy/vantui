import {
  useDidHide,
  useDidShow,
  usePullDownRefresh,
  useReachBottom,
  useReady,
  useRouter,
  stopPullDownRefresh,
} from '@tarojs/taro'
import React, { useEffect, useRef, useState } from 'react'
import { parse } from '../utils'
import { UniteContext } from '../unite-context'

function useContainer(config: any, props: any, options: any) {
  // 兼容react-refresh
  const cfgRef = useRef({}) as React.MutableRefObject<any>
  cfgRef.current = config

  // 通过ref初始化实例对象
  const insRef = useRef({}) as React.MutableRefObject<any>

  // 初始化state
  const [state, setState]: any = useState(cfgRef.current.state)

  // 定义错误收集器，页面级展示的错误可以设置到这里面
  const [error, setError]: any = useState()

  // 定义加载收集器
  const [loading, setLoading]: any = useState({
    pullDownRefresh: false,
  })

  // 通过ref定义一些开关
  const flagRef = useRef({
    _pullDownRefresh: false,
    __mounted: false,
    __init: false,
    __refactor: function () {
      insRef.current.setState = function (res: any): void {
        if (flagRef.current.__mounted) {
          if (toString.call(res) === '[object Object]') {
            setState((preState: any) => {
              return { ...preState, ...res }
            })
          } else {
            setState(res as any)
          }
        }
      }

      insRef.current.setError = function (res: any) {
        if (flagRef.current.__mounted) {
          setError(res)
        }
      }

      const _setLoading = function (obj: any): void {
        if (flagRef.current.__mounted) {
          setLoading((preState: any) => {
            return { ...preState, ...obj }
          })
        }
      }
      for (const item in cfgRef.current) {
        if (typeof cfgRef.current[item] === 'function') {
          const copyFunc = cfgRef.current[item]
          const _defined = function (this: any, ...args: any[]): any {
            let res: any
            try {
              res = copyFunc!.call(this, ...args)
              if (typeof res?.then !== 'function') {
                return res
              }
            } catch (err) {
              setError({
                code: 'JSError',
                message: '语法出现了小故障',
                data: err,
              })
            }

            const loadingTrue = {
              [item]: true,
            } as any
            const loadingFalse = {
              [item]: false,
            } as any
            try {
              return new Promise(function (resolve) {
                _setLoading(loadingTrue)
                res
                  .then(function (result: any) {
                    _setLoading(loadingFalse)
                    resolve(result)
                  })
                  .catch(function (err: any) {
                    _setLoading(loadingFalse)
                    setError({
                      code: err.code || 'JSError',
                      message: err.message || '语法出现了小故障',
                      data: err,
                    })
                  })
              })
            } catch (err) {
              _setLoading(loadingFalse)
              setError({
                code: 'JSError',
                message: '语法出现了小故障',
                data: err,
              })
            }
          }
          insRef.current[item] = _defined.bind(insRef.current)
        } else if (item !== 'state') {
          insRef.current[item] = cfgRef.current[item]
        }
      }
    },
  }) as React.MutableRefObject<any>

  // 初始化
  if (!flagRef.current.__init) {
    flagRef.current.__init = true
    flagRef.current.__refactor()
  }

  // 将loading直接赋值给实例对象，方便开发通过this.loading取值
  insRef.current.loading = loading

  // 将state直接赋值给实例对象，方便开发通过this.state取值
  insRef.current.state = state

  // 将props直接赋值给实例对象，方便开发通过this.props取值
  insRef.current.props = props

  // 将路由信息挂在到实例对象，方便开发通过this.location取值
  const routerInfo: Taro.RouterInfo = useRouter()
  if (process.env.TARO_ENV === 'h5') {
    const query = parse(location.search ? location.search.slice(1) : '')
    routerInfo.params = { ...routerInfo.params, ...query }
  }
  insRef.current.location = routerInfo

  // 将页面级错误也挂到实例对象，方便开发通过this.error取值
  // 一般不需要用到，因为页面级的错误通常是传递给render函数去渲染错误页面即可
  insRef.current.error = error

  useEffect(function () {
    const onUnload = flagRef.current?.onUnload
    flagRef.current.__mounted = true
    insRef.current?.onLoad?.()

    return function (): void {
      setError(undefined)
      onUnload?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useReady(function () {
    insRef.current?.onReady?.()
  })

  useDidShow(function () {
    flagRef.current.__mounted = true
    insRef.current?.onShow?.()
  })

  useDidHide(function () {
    insRef.current?.onHide?.()
  })

  usePullDownRefresh(async function () {
    if (!flagRef.current._pullDownRefresh) {
      flagRef.current._pullDownRefresh = true
      setLoading((preState: any) => {
        return { ...preState, pullDownRefresh: true }
      })
      if (typeof insRef.current?.onLoad === 'function') {
        const res = insRef.current?.onLoad()
        if (res.then) {
          await res
        }
      }
      if (typeof insRef.current?.onReady === 'function') {
        const res = insRef.current?.onReady()
        if (res.then) {
          await res
        }
      }
      if (typeof insRef.current?.onShow === 'function') {
        const res = insRef.current?.onShow()
        if (res.then) {
          await res
        }
      }
      if (options.stopPullDownRefreshAfterPull) {
        stopPullDownRefresh()
      }
      if (process.env.TARO_ENV === 'alipay') {
        setTimeout(() => {
          flagRef.current._pullDownRefresh = false
          setLoading((preState: any) => {
            return { ...preState, pullDownRefresh: false }
          })
        }, 500)
      } else {
        flagRef.current._pullDownRefresh = false
        setLoading((preState: any) => {
          return { ...preState, pullDownRefresh: false }
        })
      }
    }
  })

  useReachBottom(function () {
    insRef.current?.onReachBottom?.()
  })

  return { state, events: insRef.current, loading, error: error }
}

function HackComponent(props: any) {
  return props.render(props.data, props.prevProps)
}

// 使用此框架后不支持React Refresh，useRef useState的初始值都是外边传递进去的，useState({}) => 生效 | const st = {} useState(st) => 不生效
export function Unite(config: any, render: any, options: any = {}) {
  // 返回函数式组件
  return function Index(props: any) {
    const renderData = useContainer(config, props, options)
    // 执行业务侧函数式组件
    return (
      <UniteContext.Provider
        value={{
          error: renderData.error,
          pullDownRefresh: renderData.loading.pullDownRefresh,
          setError: renderData.events.setError,
        }}
      >
        <HackComponent data={renderData} render={render} prevProps={props} />
      </UniteContext.Provider>
    )
  }
}

export default Unite
