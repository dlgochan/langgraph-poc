import { WorkflowChat } from '@/components/WorkflowChat';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* 헤더 */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🔄 LangGraph HITL POC
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Human-in-the-Loop 워크플로우 데모 - Next.js + LangGraph
          </p>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-1">
        <div className="mx-auto h-full max-w-4xl p-6">
          <div className="flex h-[calc(100vh-180px)] flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <WorkflowChat />
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            LangGraph HITL POC - Built with{' '}
            <a
              href="https://nextjs.org"
              className="underline hover:text-gray-900 dark:hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              Next.js
            </a>{' '}
            &{' '}
            <a
              href="https://langchain-ai.github.io/langgraph/"
              className="underline hover:text-gray-900 dark:hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              LangGraph
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
