'use client';

import { useEffect, useState, useCallback } from 'react';
import MapComponent from '@/components/MapComponent';
import MessageForm from '@/components/MessageForm';
import { Message } from '@/lib/types';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/messages');
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      setError('Failed to load messages. Please refresh the page.');
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleMessageSubmit = useCallback(() => {
    // Refresh messages after a short delay to allow processing
    setTimeout(() => {
      fetchMessages();
    }, 2000);
  }, [fetchMessages]);

  return (
    <div className="min-h-screen bg-white">
      {/* Add padding-top to account for overlapping logo */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-12">
        <MessageForm onMessageSubmit={handleMessageSubmit} />

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-600">Loading map...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">
              Map of Oborishte District
              {messages.length > 0 && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({messages.reduce((count, msg) => count + (msg.addresses?.length || 0), 0)} location{messages.reduce((count, msg) => count + (msg.addresses?.length || 0), 0) !== 1 ? 's' : ''})
                </span>
              )}
            </h2>
            <MapComponent messages={messages} />
          </div>
        )}

        {!isLoading && messages.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Messages</h2>
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="border-b pb-4 last:border-b-0">
                  <p className="text-gray-900 mb-2">{message.text}</p>
                  {message.addresses && message.addresses.length > 0 && (
                    <div className="text-sm text-gray-600">
                      <p className="font-medium">Extracted addresses:</p>
                      <ul className="list-disc list-inside ml-2">
                        {message.addresses.map((addr, idx) => (
                          <li key={idx}>{addr.formattedAddress}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
