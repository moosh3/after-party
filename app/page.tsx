export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Event Streaming Platform</h1>
        <p className="text-slate-400 mb-8">Private event streaming coming soon</p>
        <div className="space-x-4">
          <a 
            href="/event" 
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg inline-block"
          >
            Join Event
          </a>
          <a 
            href="/admin" 
            className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-lg inline-block"
          >
            Admin Panel
          </a>
        </div>
      </div>
    </main>
  );
}

