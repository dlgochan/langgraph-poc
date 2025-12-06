import { Chat } from '@/components/Chat';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            LangGraph HITL POC
          </h1>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto h-full max-w-4xl p-6">
          <div className="flex h-[calc(100vh-180px)] flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <Chat />
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl text-center text-sm text-gray-500 dark:text-gray-400">
          Built with Next.js & LangGraph
        </div>
      </footer>
    </div>
  );
}
