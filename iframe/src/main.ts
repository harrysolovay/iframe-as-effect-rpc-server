import { RpcServer, Rpc, RpcGroup } from "@effect/rpc"
import { Deferred, Effect, Schema as S, Layer, Console } from "effect"
import { BrowserWorkerRunner } from "@effect/platform-browser"

export class AgentRpc extends RpcGroup.make(
  Rpc.make("Beep", {
    success: S.String,
    payload: {
      test: S.String,
    },
  }),
) {}

const AgentRpcLive = AgentRpc.toLayer(Effect.gen(function*() {
  yield* Effect.log("Setting up agent live")

  return {
    Beep: Effect.fn(function*({ test }) {
      console.log({ test })
      return test
    }),
  }
}))

const IframeWorkerRunner = Effect.gen(function*() {
  const deferred = yield* Deferred.make<MessagePort>()
  window.addEventListener("message", function f(e: MessageEvent) {
    const { data, ports: [port] } = e
    if (data === "connect" && port) {
      Deferred.unsafeDone(deferred, Effect.succeed(port))
      window.removeEventListener("message", f)
    }
  })
  const port = yield* Deferred.await(deferred)
  return BrowserWorkerRunner.layerMessagePort(port)
}).pipe(Layer.unwrapEffect)

Console.log("BEFORE").pipe(
  Effect.andThen(RpcServer.layer(AgentRpc).pipe(
    Layer.provide(AgentRpcLive),
    Layer.provide(RpcServer.layerProtocolWorkerRunner),
    Layer.provide(IframeWorkerRunner),
    BrowserWorkerRunner.launch,
    Effect.andThen(Console.log("AFTER")),
  )),
  Effect.runFork,
)

