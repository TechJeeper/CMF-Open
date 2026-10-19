import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useRunner } from '@/state/runner-context'
import { useWatch } from '@/state/watch-context'

const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour12: false })

function Scroller({ children, deps }: { children: React.ReactNode; deps: unknown }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [deps])
  return (
    <div ref={ref} className="h-56 overflow-y-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-relaxed">
      {children}
    </div>
  )
}

export function LogPanel() {
  const r = useRunner()
  const w = useWatch()
  return (
    <Tabs defaultValue="app">
      <div className="flex items-center gap-2">
        <TabsList>
          <TabsTrigger value="app">App log</TabsTrigger>
          <TabsTrigger value="wire">Bluetooth</TabsTrigger>
        </TabsList>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={r.clearLogs}>
          Clear
        </Button>
      </div>
      <TabsContent value="app">
        <Scroller deps={r.logs.length}>
          {r.logs.length ? (
            r.logs.map((l, i) => (
              <div key={i} className={cn(l.level === 'error' && 'text-red-400', l.level === 'warn' && 'text-amber-300')}>
                <span className="text-white/30">{time(l.at)} </span>
                {l.text}
              </div>
            ))
          ) : (
            <span className="text-white/40">Messages from watch.log() and app errors show up here.</span>
          )}
        </Scroller>
      </TabsContent>
      <TabsContent value="wire">
        <Scroller deps={w.wire.length}>
          {w.wire.length ? (
            w.wire.map((l, i) => (
              <div key={i} className={cn(l.dir === '!!' && 'text-red-400', l.dir === '..' && 'text-white/50')}>
                <span className="text-white/30">{time(l.at)} </span>
                <span className={l.dir === '->' ? 'text-sky-300' : l.dir === '<-' ? 'text-emerald-300' : ''}>{l.dir}</span>{' '}
                {l.text}
              </div>
            ))
          ) : (
            <span className="text-white/40">Decoded protocol frames appear here once a watch is connected.</span>
          )}
        </Scroller>
      </TabsContent>
    </Tabs>
  )
}
