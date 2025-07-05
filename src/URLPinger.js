import React, { useState, useEffect } from 'react';

const URLPinger = ({ supabase, session, darkMode }) => {
  const [urls, setUrls] = useState([]);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [pinging, setPinging] = useState({});
  const [autoPingSettings, setAutoPingSettings] = useState(() => {
    // Load saved auto-ping settings from localStorage
    const saved = localStorage.getItem('autoPingSettings');
    return saved ? JSON.parse(saved) : {};
  });
  const [pingIntervals, setPingIntervals] = useState(() => {
    // Load saved ping intervals from localStorage
    const saved = localStorage.getItem('pingIntervals');
    return saved ? JSON.parse(saved) : {};
  });

  // Save auto-ping settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('autoPingSettings', JSON.stringify(autoPingSettings));
  }, [autoPingSettings]);

  // Save ping intervals to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('pingIntervals', JSON.stringify(pingIntervals));
  }, [pingIntervals]);

  useEffect(() => {
    fetchUrls();
  }, []);

  // Individual auto-ping functionality for each URL
  useEffect(() => {
    const intervals = {};
    
    urls.forEach(url => {
      // Clear existing interval if any
      if (intervals[url.id]) {
        clearInterval(intervals[url.id]);
      }
      
      // Set up new interval if auto-ping is enabled for this URL
      if (autoPingSettings[url.id]) {
        const intervalTime = (pingIntervals[url.id] || 5) * 60 * 1000; // Convert minutes to milliseconds
        
        intervals[url.id] = setInterval(() => {
          if (!pinging[url.id]) {
            console.log(`Auto-pinging ${url.name} (${url.url})`);
            pingUrl(url.url, url.id);
          }
        }, intervalTime);
      }
    });

    // Cleanup function
    return () => {
      Object.values(intervals).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, [urls, autoPingSettings, pingIntervals, pinging]);

  // Initialize auto-ping settings when URLs are loaded
  useEffect(() => {
    if (urls.length > 0) {
      urls.forEach(url => {
        // Only set defaults if not already in localStorage
        setAutoPingSettings(prev => {
          if (prev[url.id] === undefined) {
            return { ...prev, [url.id]: false };
          }
          return prev;
        });
        
        setPingIntervals(prev => {
          if (prev[url.id] === undefined) {
            return { ...prev, [url.id]: 5 };
          }
          return prev;
        });
      });
    }
  }, [urls]);

  const fetchUrls = async () => {
    const { data, error } = await supabase
      .from('urls')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching URLs:', error);
    } else {
      setUrls(data || []);
    }
  };

  const addUrl = async (e) => {
    e.preventDefault();
    if (!newUrl.trim() || !newName.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('urls')
        .insert([
          {
            url: newUrl.trim(),
            name: newName.trim(),
            user_id: session.user.id,
          }
        ])
        .select();

      if (error) {
        alert('Error adding URL: ' + error.message);
      } else {
        setUrls([...data, ...urls]);
        setNewUrl('');
        setNewName('');
      }
    } catch (error) {
      alert('Error adding URL: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteUrl = async (id) => {
    const { error } = await supabase
      .from('urls')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error deleting URL: ' + error.message);
    } else {
      setUrls(urls.filter(url => url.id !== id));
      
      // Clean up saved settings for deleted URL
      setAutoPingSettings(prev => {
        const newSettings = { ...prev };
        delete newSettings[id];
        return newSettings;
      });
      
      setPingIntervals(prev => {
        const newIntervals = { ...prev };
        delete newIntervals[id];
        return newIntervals;
      });
    }
  };

  const pingUrl = async (url, id) => {
    setPinging(prev => ({ ...prev, [id]: true }));
    
    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors', // This will limit what we can see, but avoids CORS issues
      });
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Update the URL record with ping result
      const { error } = await supabase
        .from('urls')
        .update({
          last_ping: new Date().toISOString(),
          response_time: responseTime,
          status: 'success'
        })
        .eq('id', id);

      if (!error) {
        fetchUrls(); // Refresh the list
      }
    } catch (error) {
      // Update with error status
      await supabase
        .from('urls')
        .update({
          last_ping: new Date().toISOString(),
          status: 'error'
        })
        .eq('id', id);
      
      fetchUrls();
    } finally {
      setPinging(prev => ({ ...prev, [id]: false }));
    }
  };

  const toggleAutoPing = (urlId) => {
    setAutoPingSettings(prev => ({
      ...prev,
      [urlId]: !prev[urlId]
    }));
  };

  const updatePingInterval = (urlId, interval) => {
    setPingIntervals(prev => ({
      ...prev,
      [urlId]: interval
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status, isAutoPingEnabled, lastPing) => {
    // If auto-ping is disabled and there's no recent ping, show as inactive
    if (!isAutoPingEnabled && (!lastPing || isOlderThan30Minutes(lastPing))) {
      return darkMode 
        ? 'text-gray-400 bg-gray-800 border-gray-600' 
        : 'text-gray-600 bg-gray-100 border-gray-300';
    }
    
    const colors = {
      success: darkMode 
        ? 'text-green-400 bg-green-900/30 border-green-700' 
        : 'text-green-700 bg-green-50 border-green-200',
      error: darkMode 
        ? 'text-red-400 bg-red-900/30 border-red-700' 
        : 'text-red-700 bg-red-50 border-red-200',
      default: darkMode 
        ? 'text-gray-400 bg-gray-800 border-gray-600' 
        : 'text-gray-600 bg-gray-100 border-gray-300'
    };
    return colors[status] || colors.default;
  };

  const getStatusText = (status, isAutoPingEnabled, lastPing) => {
    // If auto-ping is disabled and there's no recent ping, show as inactive
    if (!isAutoPingEnabled && (!lastPing || isOlderThan30Minutes(lastPing))) {
      return 'inactive';
    }
    return status || 'pending';
  };

  const isOlderThan30Minutes = (dateString) => {
    if (!dateString) return true;
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    return new Date(dateString) < thirtyMinutesAgo;
  };

  return (
    <div className="space-y-6">
      {/* Add URL Form */}
      <div className={`rounded-xl shadow-lg border transition-all duration-300 hover:shadow-xl ${
        darkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
              <svg className={`w-6 h-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Add New URL
            </h2>
          </div>
          <form onSubmit={addUrl} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="name" className={`block text-base font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Website Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={`input-scale w-full rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-4 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500/20'
                  }`}
                  placeholder="My Awesome Website"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="url" className={`block text-base font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  URL Address
                </label>
                <input
                  type="url"
                  id="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className={`input-scale w-full rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-4 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500/20'
                  }`}
                  placeholder="https://example.com"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`btn-scale w-full md:w-auto rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                darkMode
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 focus:ring-blue-500/20'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 focus:ring-blue-500/20'
              }`}
            >
              {loading ? (
                <span className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Adding...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add URL</span>
                </span>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* URLs List */}
      <div className={`rounded-xl shadow-lg border transition-all duration-300 hover:shadow-xl ${
        darkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-green-900/30' : 'bg-green-100'}`}>
              <svg className={`w-6 h-6 ${darkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Your URLs ({urls.length})
            </h2>
          </div>
        </div>
        
        {urls.length === 0 ? (
          <div className={`p-12 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
              darkMode ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              No URLs Added Yet
            </h3>
            <p className="text-base">Add your first URL above to start monitoring!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-scale min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={darkMode ? 'bg-gray-900/50' : 'bg-gray-50'}>
                <tr>
                  <th className={`table-scale text-left font-bold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Website
                  </th>
                  <th className={`table-scale text-left font-bold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    URL
                  </th>
                  <th className={`table-scale text-left font-bold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Status
                  </th>
                  <th className={`table-scale text-left font-bold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Last Ping
                  </th>
                  <th className={`table-scale text-left font-bold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Response
                  </th>
                  <th className={`table-scale text-left font-bold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Auto-Ping
                  </th>
                  <th className={`table-scale text-right font-bold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    <span className="text-base font-extrabold">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {urls.map((url) => (
                  <tr key={url.id} className={`transition-colors duration-200 ${
                    darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                  }`}>
                    <td className={`table-scale whitespace-nowrap ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          darkMode ? 'bg-blue-900/30' : 'bg-blue-100'
                        }`}>
                          <svg className={`w-6 h-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-base font-bold">{url.name}</div>
                          <div className={`text-sm-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Added {new Date(url.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={`table-scale whitespace-nowrap ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      <a
                        href={url.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`hover:underline transition-colors duration-200 ${
                          darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
                        }`}
                      >
                        {url.url.length > 40 ? `${url.url.substring(0, 40)}...` : url.url}
                      </a>
                    </td>
                    <td className="table-scale whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-2 rounded-full text-sm-lg font-semibold border ${getStatusColor(url.status, autoPingSettings[url.id], url.last_ping)}`}>
                        <div className={`w-3 h-3 rounded-full mr-2 ${
                          getStatusText(url.status, autoPingSettings[url.id], url.last_ping) === 'success' ? 'bg-green-500' : 
                          getStatusText(url.status, autoPingSettings[url.id], url.last_ping) === 'error' ? 'bg-red-500' : 
                          getStatusText(url.status, autoPingSettings[url.id], url.last_ping) === 'inactive' ? 'bg-gray-400' : 'bg-gray-400'
                        }`}></div>
                        {getStatusText(url.status, autoPingSettings[url.id], url.last_ping)}
                      </span>
                    </td>
                    <td className={`table-scale whitespace-nowrap ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      <div className="flex flex-col">
                        <span className="text-sm-lg">{formatDate(url.last_ping)}</span>
                      </div>
                    </td>
                    <td className={`table-scale whitespace-nowrap ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      <div className="flex items-center space-x-2">
                        {url.response_time && (
                          <span className={`px-3 py-1 rounded-md text-sm-lg font-medium ${
                            url.response_time < 1000 
                              ? darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                              : darkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {url.response_time}ms
                          </span>
                        )}
                        {!url.response_time && <span className="text-sm-lg">-</span>}
                      </div>
                    </td>
                    <td className="table-scale whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={autoPingSettings[url.id] || false}
                            onChange={() => toggleAutoPing(url.id)}
                            className={`w-5 h-5 rounded transition-colors duration-200 ${
                              darkMode 
                                ? 'text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500/20' 
                                : 'text-blue-600 bg-white border-gray-300 focus:ring-blue-500/20'
                            }`}
                          />
                          <span className={`text-sm-lg font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Auto
                          </span>
                        </label>
                        
                        <select
                          value={pingIntervals[url.id] || 5}
                          onChange={(e) => updatePingInterval(url.id, Number(e.target.value))}
                          disabled={!autoPingSettings[url.id]}
                          className={`text-sm-lg rounded-md border transition-colors duration-200 focus:outline-none focus:ring-2 px-3 py-2 ${
                            darkMode
                              ? 'bg-gray-700 border-gray-600 text-gray-300 focus:ring-blue-500/20 disabled:bg-gray-800 disabled:text-gray-500'
                              : 'bg-white border-gray-300 text-gray-700 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:text-gray-400'
                          }`}
                        >
                          <option value={1}>1m</option>
                          <option value={2}>2m</option>
                          <option value={5}>5m</option>
                          <option value={10}>10m</option>
                          <option value={15}>15m</option>
                          <option value={30}>30m</option>
                          <option value={60}>1h</option>
                        </select>
                        
                        {autoPingSettings[url.id] && (
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <span className={`text-sm-lg font-medium ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                              Active
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="table-scale whitespace-nowrap text-right">
                      <div className="flex flex-col items-end space-y-1">
                        <button
                          onClick={() => pingUrl(url.url, url.id)}
                          disabled={pinging[url.id]}
                          className={`btn-scale rounded-xl text-sm font-bold transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none w-[110px] py-2 px-4 ${
                            darkMode
                              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500/30 shadow-blue-900/50'
                              : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500/30 shadow-blue-900/30'
                          }`}
                        >
                          {pinging[url.id] ? (
                            <span className="flex items-center justify-center space-x-1">
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              <span>Pinging</span>
                            </span>
                          ) : (
                            <span className="flex items-center justify-center space-x-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              <span>PING</span>
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => deleteUrl(url.id)}
                          className={`btn-scale rounded-xl text-sm font-bold transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 shadow-lg hover:shadow-xl w-[110px] py-2 px-4 ${
                            darkMode
                              ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 focus:ring-red-500/30 shadow-red-900/50'
                              : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 focus:ring-red-500/30 shadow-red-900/30'
                          }`}
                        >
                          <span className="flex items-center justify-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>DELETE</span>
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default URLPinger;
