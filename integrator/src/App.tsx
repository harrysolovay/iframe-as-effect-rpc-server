import { Atom, useAtomMount } from "@effect-atom/atom-react"
import { Effect, Layer,  Schema as S } from "effect"
import { BrowserWorker } from "@effect/platform-browser"
import { RpcClient, Rpc, RpcGroup } from "@effect/rpc"

export const IframeWorker = Effect.gen(function*() {
  const channel = new MessageChannel()
  const latch = yield* Effect.makeLatch(false)
  const iframe = document.createElement("iframe")
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin")
  iframe.setAttribute("src", "http://localhost:7777")
  iframe.onload = () => latch.unsafeOpen()
  document.body.appendChild(iframe)
  yield* latch.await
  console.log(iframe)
  const { contentWindow } = iframe
  contentWindow!.postMessage("connect", "*", [channel.port2])
  return BrowserWorker.layerPlatform(() => channel.port1)
}).pipe(
  Layer.unwrapEffect
)

class AgentRpc extends RpcGroup.make(
  Rpc.make("Beep", {
    success: S.String,
    payload: {
      test: S.String,
    },
  }),
) {}

class LinkService extends Effect.Service<LinkService>()("@crosshatch/LinkService", {
  dependencies: [
    RpcClient.layerProtocolWorker({ size: 1 }).pipe(
      Layer.provide(IframeWorker),
    ),
  ],
  scoped: Effect.gen(function*() {
    console.log("HERE?")
    return {
      client: yield* RpcClient.make(AgentRpc),
    }
  }),
}) {}

const linkAtom = Atom.make(Effect.gen(function*() {
  console.log("DOES THIS RUN?")
  const { client } = yield* LinkService
  const result = yield* client.Beep({
    test: "HELLO",
  })
  console.log({result})
}).pipe(
  Effect.provide(LinkService.Default)    
))


export const App = () => {
  useAtomMount(linkAtom)
  return <div />
}
