import { Atom, useAtomMount } from "@effect-atom/atom-react"
import { Effect, Layer, Stream, Schema as S } from "effect"
import { BrowserWorker } from "@effect/platform-browser"
import { RpcClient, Rpc, RpcGroup } from "@effect/rpc"

export const contextReady = Effect.fn(function*(target: Window) {
  if (target.document.readyState !== "complete") {
    yield* Stream.fromEventListener(target, "load", {
      once: true,
    }).pipe(
      Stream.runDrain,
    )
  }
})

export const IframeWorker = Effect.fnUntraced(function*(iframe: HTMLIFrameElement) {
  const channel = new MessageChannel()
  const contentWindow = yield* Effect.fromNullable(iframe.contentWindow)
  yield* contextReady(contentWindow)
  contentWindow.postMessage("connect", "*", [channel.port2])
  return BrowserWorker.layerPlatform(() => channel.port1)
}, Layer.unwrapEffect)

class AgentRpc extends RpcGroup.make(
  Rpc.make("Beep", {
    success: S.String,
    payload: {
      test: S.String,
    },
  }),
) {}

let linked: HTMLIFrameElement | undefined
export const link = () => {
  if (!linked) {
    linked = document.createElement("iframe")
    linked.setAttribute("data-crosshatch", "link")
    Object.assign(linked, {
      sandbox: "allow-scripts allow-same-origin",
      src: `http://localhost:7777`,
    })
    document.body.appendChild(linked)
  }
  return linked
}

class LinkService extends Effect.Service<LinkService>()("@crosshatch/LinkService", {
  dependencies: [
    RpcClient.layerProtocolWorker({ size: 1 }).pipe(
      Layer.provide(Layer.suspend(() => IframeWorker(link()))),
    ),
  ],
  scoped: Effect.gen(function*() {
    console.log("HERE?")
    return {
      client: yield* RpcClient.make(AgentRpc),
    }
  }),
}) {}

const runtimeAtom = Atom.runtime(LinkService.Default)

const linkAtom = runtimeAtom.atom(Effect.gen(function*() {
  console.log("DOES THIS RUN?")
  const { client } = yield* LinkService
  const result = yield* client.Beep({
    test: "HELLO",
  })
  console.log({result})
}))


export const App = () => {
  useAtomMount(linkAtom)
  return <div />
}
