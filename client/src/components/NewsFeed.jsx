// src/components/NewsFeed.jsx
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";

const PAGE_SIZE = 20;

function NewsFeed({ symbol }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!symbol) return;

    setLoading(true);
    setPage(1); // reset al cambiar ticker

    axios
      .get(`/api/news/${symbol}`)
      .then((res) => {
        setNews(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [symbol]);

  // 🔥 Ordenar por fecha (más reciente primero)
  const sortedNews = useMemo(() => {
    return [...news].sort((a, b) => b.datetime - a.datetime);
  }, [news]);

  // 📄 Paginación
  const paginatedNews = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedNews.slice(start, start + PAGE_SIZE);
  }, [sortedNews, page]);

  if (loading) {
    return (
      <p className="text-gray-400 text-center animate-pulse">
        Loading market news…
      </p>
    );
  }

  if (!sortedNews.length) {
    return (
      <p className="text-center text-gray-500">
        No recent news for <b>{symbol}</b>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {paginatedNews.map((item, i) => (
        <article
          key={i}
          className="flex gap-3 border-b pb-3 last:border-none"
        >
          {/* 🖼 IMAGE */}
          {item.image ? (
            <img
              src={item.image}
              alt=""
              className="w-20 h-14 object-cover rounded border"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="w-20 h-14 bg-gray-100 rounded border" />
          )}

          {/* 📰 CONTENT */}
          <div className="flex-1">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-semibold text-blue-600 hover:underline leading-snug"
            >
              {item.headline}
            </a>

            <div className="mt-0.5 text-xs text-gray-400">
              {item.source || "Unknown"} ·{" "}
              {new Date(item.datetime * 1000).toLocaleString()}
            </div>

            {item.summary && (
              <p className="mt-1 text-sm text-gray-600 leading-snug line-clamp-2">
                {item.summary}
              </p>
            )}
          </div>
        </article>
      ))}

      {/* 📄 PAGINATION */}
      <div className="flex justify-between items-center pt-3 text-sm">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1 rounded border disabled:opacity-40"
        >
          ← Previous
        </button>

        <span className="text-gray-400">
          Page {page} of {Math.ceil(sortedNews.length / PAGE_SIZE)}
        </span>

        <button
          disabled={page * PAGE_SIZE >= sortedNews.length}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1 rounded border disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

export default NewsFeed;
