import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface TerminalTabProps {
  sessionId: string
  isActive: boolean
}

export default function TerminalTab({ sessionId, isActive }: TerminalTabProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])
  const isActiveRef = useRef(isActive)

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const setupTerminal = useCallback(() => {
    if (!terminalRef.current || termRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        cursorAccent: '#1e1e2e',
        selectionBackground: '#585b70',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8'
      }
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    term.loadAddon(webLinksAddon)

    term.open(terminalRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Send data to SSH
    term.onData((data) => {
      window.sshApi.writeToShell(sessionId, data)
    })

    // Receive data from SSH
    const removeDataListener = window.sshApi.onShellData(sessionId, (data) => {
      term.write(data)
    })

    const removeCloseListener = window.sshApi.onShellClose(sessionId, () => {
      term.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n')
    })

    cleanupRef.current.push(removeDataListener, removeCloseListener)

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && isActiveRef.current) {
        fitAddonRef.current.fit()
        const { cols, rows } = term
        window.sshApi.resizeShell(sessionId, cols, rows)
      }
    })

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current)
    }

    cleanupRef.current.push(() => resizeObserver.disconnect())

    // Send initial size
    window.sshApi.resizeShell(sessionId, term.cols, term.rows)
  }, [sessionId])

  useEffect(() => {
    setupTerminal()

    return () => {
      cleanupRef.current.forEach(fn => fn())
      cleanupRef.current = []
      if (termRef.current) {
        termRef.current.dispose()
        termRef.current = null
      }
    }
  }, [setupTerminal])

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit()
        if (termRef.current) {
          window.sshApi.resizeShell(sessionId, termRef.current.cols, termRef.current.rows)
        }
      }, 50)
    }
  }, [isActive, sessionId])

  return (
    <div
      ref={terminalRef}
      className="w-full h-full"
    />
  )
}
