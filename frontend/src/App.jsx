import React, { useState, useEffect, createContext, useContext } from 'react';
import { Upload, FileText, Search, Settings, BarChart2, ChevronLeft, ChevronRight, X, Loader2, AlertCircle, Inbox, LogOut, CheckCircle } from 'lucide-react';

// --- STYLING & TAILWIND CONFIG ---
const globalStyles = `
  .risk-low { color: #22c55e; } /* green-500 */
  .risk-medium { color: #f59e0b; } /* amber-500 */
  .risk-high { color: #ef4444; } /* red-500 */
`;

// --- AUTHENTICATION CONTEXT ---
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token'));

    const login = (newToken) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
    };

    const isAuthenticated = !!token;

    return (
        <AuthContext.Provider value={{ token, login, logout, isAuthenticated }}>
            {children}
        </AuthContext.Provider>
    );
};

const useAuth = () => useContext(AuthContext);

// --- API SERVICE ---
// For development, we'll hardcode the URL to avoid build tool-specific issues.
// For deployment, this would be replaced with a proper environment variable.
const API_URL = 'http://localhost:8000';

const api = {
    async request(endpoint, options = {}) {
        const { body, ...customConfig } = options;
        const token = localStorage.getItem('token');
        
        // Default headers
        const headers = {};
        if (!(body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            method: body ? 'POST' : 'GET',
            ...customConfig,
            headers: {
                ...headers,
                ...customConfig.headers,
            },
        };

        if (body) {
            if (body instanceof FormData || body instanceof URLSearchParams) {
                config.body = body;
            } else {
                config.body = JSON.stringify(body);
            }
        }

        try {
            console.log(`--- Making API Request ---`);
            console.log(`URL: ${API_URL}${endpoint}`);
            console.log(`Options:`, config);

            const response = await fetch(`${API_URL}${endpoint}`, config);

            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login';
                return Promise.reject(new Error("Unauthorized"));
            }

            const responseData = await response.json().catch(() => ({ detail: response.statusText }));

            if (!response.ok) {
                 console.error(`API request failed with status: ${response.status}`, responseData);
                return Promise.reject(responseData);
            }
            
            return responseData;

        } catch (error) {
            console.error('!!! CRITICAL API REQUEST FAILED !!!', error);
            console.error('This is likely a network error or a CORS issue.');
            return Promise.reject({ detail: "Network error or server is down." });
        }
    },

    signup(username, password) {
        return this.request('/signup', { body: { username, password } });
    },

    login(username, password) {
        // OAuth2 expects form data, not JSON
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        return this.request('/login', {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    },

    getContracts() {
        return this.request('/contracts');
    },
    
    getContractDetails(docId) {
        return this.request(`/contracts/${docId}`);
    },

    uploadContract(formData) {
        return this.request('/upload', {
            method: 'POST',
            body: formData,
        });
    },

    askQuestion(question) {
        return this.request('/ask', { body: { question } });
    },
};

// --- HELPER COMPONENTS ---
const LoadingSpinner = ({ className = "w-6 h-6" }) => (
    <Loader2 className={`animate-spin text-indigo-500 ${className}`} />
);

const ErrorMessage = ({ message, onClear }) => (
    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md relative" role="alert">
        <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
            <div>
                <p className="font-bold">Error</p>
                <p>{message || "An unknown error occurred."}</p>
            </div>
        </div>
        {onClear && <button onClick={onClear} className="absolute top-2 right-2 text-red-500 hover:text-red-700"><X size={18} /></button>}
    </div>
);

const SuccessMessage = ({ message, onClear }) => (
     <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md relative" role="alert">
        <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <div>
                <p className="font-bold">Success</p>
                <p>{message}</p>
            </div>
        </div>
        {onClear && <button onClick={onClear} className="absolute top-2 right-2 text-green-500 hover:text-green-700"><X size={18} /></button>}
    </div>
);


const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl transform transition-all">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};


// --- LAYOUT COMPONENTS ---

const Sidebar = ({ setPage, page }) => {
    const { logout } = useAuth();
    const navItems = [
        { name: 'Contracts', icon: FileText, id: 'dashboard' },
        { name: 'Query', icon: Search, id: 'query' },
        { name: 'Upload', icon: Upload, id: 'upload' },
        { name: 'Insights', icon: BarChart2, id: 'insights' },
        { name: 'Settings', icon: Settings, id: 'settings' },
    ];

    return (
        <aside className="w-64 bg-gray-800 text-white flex flex-col">
            <div className="p-6 text-2xl font-bold border-b border-gray-700">
                CONTRACTX
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2">
                {navItems.map(item => (
                    <a
                        key={item.id}
                        href="#"
                        onClick={(e) => { e.preventDefault(); setPage(item.id); }}
                        className={`flex items-center px-4 py-2.5 rounded-lg transition-colors ${page === item.id ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                    >
                        <item.icon className="w-5 h-5 mr-3" />
                        <span className="font-medium">{item.name}</span>
                    </a>
                ))}
            </nav>
            <div className="p-4 border-t border-gray-700">
                 <button
                    onClick={logout}
                    className="w-full flex items-center px-4 py-2.5 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                    <LogOut className="w-5 h-5 mr-3" />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
};

const MainContent = ({ children }) => {
    return (
        <main className="flex-1 p-6 md:p-10 bg-gray-50 overflow-y-auto">
            {children}
        </main>
    );
};


// --- PAGE COMPONENTS ---

const LoginPage = () => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (isLoginView) {
                const data = await api.login(username, password);
                login(data.access_token);
            } else {
                await api.signup(username, password);
                // Automatically log in after successful signup
                const data = await api.login(username, password);
                login(data.access_token);
            }
        } catch (err) {
            console.error("Caught error in handleSubmit:", err);
            // Handle FastAPI 422 validation errors which come in an array
            if (err.detail && Array.isArray(err.detail)) {
                const message = err.detail.map(d => `${d.loc[1]}: ${d.msg}`).join(', ');
                setError(message);
            } else {
                setError(err.detail || `Failed to ${isLoginView ? 'login' : 'sign up'}.`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h2 className="text-3xl font-extrabold text-center text-gray-900">
                    {isLoginView ? 'Sign in to your account' : 'Create a new account'}
                </h2>
                <form className="space-y-6" onSubmit={handleSubmit}>
                    {error && <ErrorMessage message={error} onClear={() => setError(null)} />}
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        required
                        className="w-full px-4 py-2 text-gray-700 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        className="w-full px-4 py-2 text-gray-700 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 flex items-center justify-center"
                    >
                        {loading && <LoadingSpinner className="w-5 h-5 mr-2" />}
                        {isLoginView ? 'Login' : 'Sign Up'}
                    </button>
                </form>
                <p className="text-sm text-center text-gray-600">
                    {isLoginView ? "Don't have an account? " : "Already have an account? "}
                    <button onClick={() => setIsLoginView(!isLoginView)} className="font-medium text-indigo-600 hover:text-indigo-500">
                        {isLoginView ? 'Sign up' : 'Sign in'}
                    </button>
                </p>
            </div>
        </div>
    );
};

const DashboardPage = ({ setPage, setSelectedDocId }) => {
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchContracts = async () => {
            try {
                const data = await api.getContracts();
                setContracts(data);
            } catch (err) {
                setError(err.detail || 'Failed to fetch contracts.');
            } finally {
                setLoading(false);
            }
        };
        fetchContracts();
    }, []);

    const handleViewDetails = (docId) => {
        setSelectedDocId(docId);
        setPage('contract-detail');
    };
    
    const RiskScore = ({ score }) => (
         <span className={`font-semibold risk-${score?.toLowerCase()}`}>{score}</span>
    );
    
    const StatusBadge = ({ status }) => {
        const color = status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800';
        return <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>{status}</span>
    }

    if (loading) {
        return <div className="flex justify-center items-center h-full"><LoadingSpinner className="w-12 h-12"/></div>;
    }
    
    if (error) {
        return <ErrorMessage message={error} />;
    }

    return (
        <div>
            <style>{globalStyles}</style>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Contracts Dashboard</h1>
            
            {contracts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-lg shadow">
                    <Inbox className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No contracts found</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by uploading your first contract.</p>
                    <div className="mt-6">
                        <button
                            onClick={() => setPage('upload')}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                            <Upload className="-ml-1 mr-2 h-5 w-5" />
                            Upload Contract
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contract Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parties</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Score</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {contracts.map(contract => (
                                    <tr key={contract.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{contract.filename}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contract.parties}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(contract.expiry_date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><StatusBadge status={contract.status} /></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm"><RiskScore score={contract.risk_score} /></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleViewDetails(contract.id)} className="text-indigo-600 hover:text-indigo-900">View Details</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

const ContractDetailPage = ({ docId, setPage }) => {
    const [contract, setContract] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
    const [evidenceContent, setEvidenceContent] = useState(null);

    useEffect(() => {
        if (!docId) return;
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const data = await api.getContractDetails(docId);
                setContract(data);
            } catch (err) {
                setError(err.detail || 'Failed to fetch contract details.');
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [docId]);
    
    const openEvidence = (clause) => {
        setEvidenceContent(clause);
        setEvidenceDrawerOpen(true);
    };

    if (loading) return <div className="flex justify-center items-center h-full"><LoadingSpinner className="w-12 h-12"/></div>;
    if (error) return <ErrorMessage message={error} />;
    if (!contract) return <div>No contract data.</div>;
    
    const RiskScore = ({ score }) => (
         <span className={`font-semibold risk-${score?.toLowerCase()}`}>{score}</span>
    );
    
    return (
        <div>
            <style>{globalStyles}</style>
            <button onClick={() => setPage('dashboard')} className="flex items-center text-sm text-indigo-600 hover:underline mb-4">
                <ChevronLeft size={16} className="mr-1"/> Back to Contracts
            </button>
            
            <header className="bg-white p-6 rounded-lg shadow mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{contract.filename}</h1>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div><span className="font-semibold text-gray-600 block">Parties</span> {contract.parties}</div>
                    <div><span className="font-semibold text-gray-600 block">Expiry Date</span> {new Date(contract.expiry_date).toLocaleDateString()}</div>
                    <div><span className="font-semibold text-gray-600 block">Status</span> {contract.status}</div>
                    <div><span className="font-semibold text-gray-600 block">Risk Score</span> <RiskScore score={contract.risk_score} /></div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">Extracted Clauses</h2>
                    <div className="space-y-4">
                        {contract.clauses.map(clause => (
                            <div key={clause.id} className="bg-white p-4 rounded-lg shadow">
                                <h3 className="font-semibold text-gray-800">{clause.chunk_metadata?.clause_title || 'Clause'}</h3>
                                <p className="text-gray-600 text-sm mt-1">{clause.text_chunk}</p>
                                <div className="flex justify-between items-center mt-3 text-xs">
                                    <span className="text-gray-500">Page: {clause.chunk_metadata?.page || 'N/A'}</span>
                                    <button onClick={() => openEvidence(clause)} className="text-indigo-600 hover:text-indigo-800 font-semibold">View Evidence</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="lg:col-span-1">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">AI Insights</h2>
                     <div className="bg-white p-4 rounded-lg shadow space-y-4">
                        {contract.insights.map(insight => (
                             <div key={insight.id}>
                                <h4 className={`text-sm font-semibold ${insight.type === 'risk' ? 'text-red-600' : 'text-green-600'}`}>{insight.type === 'risk' ? 'Risk Identified' : 'Recommendation'}</h4>
                                <p className="text-gray-600 text-sm">{insight.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <Modal isOpen={evidenceDrawerOpen} onClose={() => setEvidenceDrawerOpen(false)} title="Evidence Snippet">
                {evidenceContent && (
                    <div>
                        <p className="text-gray-700 mb-4">"{evidenceContent.text_chunk}"</p>
                        <div className="text-xs text-gray-500">
                            <span>Source: {evidenceContent.chunk_metadata?.contract_name}</span> |
                            <span className="mx-2">Page: {evidenceContent.chunk_metadata?.page}</span> |
                            <span className="ml-2">Relevance: 95%</span>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

const UploadPage = () => {
    const [file, setFile] = useState(null);
    const [parties, setParties] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };
    
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            setFile(droppedFile);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file || !parties || !expiryDate) {
            setError("All fields are required.");
            return;
        }
        setError(null);
        setSuccess(null);
        setLoading(true);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('parties', parties);
        formData.append('expiry_date', expiryDate);

        try {
            const result = await api.uploadContract(formData);
            setSuccess(`Successfully uploaded ${result.filename}.`);
            setFile(null);
            setParties('');
            setExpiryDate('');
        } catch (err) {
            setError(err.detail || "File upload failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Upload New Contract</h1>
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && <ErrorMessage message={error} onClear={() => setError(null)} />}
                    {success && <SuccessMessage message={success} onClear={() => setSuccess(null)} />}
                    
                    <div
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
                        onDrop={handleDrop}
                        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors ${isDragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}`}
                    >
                        <div className="space-y-1 text-center">
                             <FileText className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="flex text-sm text-gray-600">
                                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                    <span>Upload a file</span>
                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.txt,.docx" />
                                </label>
                                <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">PDF, TXT, DOCX up to 10MB</p>
                            {file && <p className="text-sm text-green-600 mt-2">Selected: {file.name}</p>}
                        </div>
                    </div>
                    
                    <div>
                        <label htmlFor="parties" className="block text-sm font-medium text-gray-700">Parties Involved</label>
                        <input type="text" id="parties" value={parties} onChange={(e) => setParties(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                     <div>
                        <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700">Expiry Date</label>
                        <input type="date" id="expiryDate" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400">
                        {loading ? <LoadingSpinner /> : 'Upload and Process'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const QueryPage = () => {
    const [question, setQuestion] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const data = await api.askQuestion(question);
            setResult(data);
        } catch (err) {
            setError(err.detail || "Failed to get an answer.");
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Query Your Contracts</h1>
            <div className="max-w-3xl mx-auto">
                <div className="bg-white p-8 rounded-lg shadow">
                    <form onSubmit={handleSubmit}>
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Ask a question about your contracts, e.g., 'What are the termination conditions for the MSA agreement?'"
                            className="w-full h-24 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        ></textarea>
                        <button type="submit" disabled={loading} className="mt-4 w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400">
                            {loading ? <LoadingSpinner /> : 'Ask Question'}
                        </button>
                    </form>
                </div>

                {error && <div className="mt-6"><ErrorMessage message={error} /></div>}

                {result && (
                    <div className="mt-8">
                         <h2 className="text-xl font-semibold text-gray-700 mb-4">AI-Generated Answer</h2>
                         <div className="bg-white p-6 rounded-lg shadow">
                            <p className="text-gray-800">{result.answer}</p>
                         </div>

                         <h2 className="text-xl font-semibold text-gray-700 mb-4 mt-8">Retrieved Chunks</h2>
                         <div className="space-y-4">
                            {result.retrieved_chunks.map(chunk => (
                                <div key={chunk.id} className="bg-white p-4 rounded-lg shadow">
                                    <p className="text-gray-600 text-sm">{chunk.text_chunk}</p>
                                     <div className="text-xs text-gray-500 mt-3">
                                        <span>Source: {chunk.chunk_metadata?.contract_name}</span> |
                                        <span className="mx-2">Page: {chunk.chunk_metadata?.page}</span>
                                    </div>
                                </div>
                            ))}
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const PlaceholderPage = ({ title }) => (
    <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-6">{title}</h1>
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            <p>This is a placeholder page for the "{title}" section.</p>
            <p>Functionality to be implemented in a future version.</p>
        </div>
    </div>
);


// --- MAIN APP COMPONENT ---
function App() {
    const { isAuthenticated } = useAuth();
    const [page, setPage] = useState('dashboard');
    const [selectedDocId, setSelectedDocId] = useState(null);

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    const renderPage = () => {
        switch (page) {
            case 'dashboard':
                return <DashboardPage setPage={setPage} setSelectedDocId={setSelectedDocId} />;
            case 'contract-detail':
                return <ContractDetailPage docId={selectedDocId} setPage={setPage} />;
            case 'upload':
                return <UploadPage />;
            case 'query':
                return <QueryPage />;
            case 'insights':
                return <PlaceholderPage title="Insights" />;
             case 'settings':
                return <PlaceholderPage title="Settings" />;
            default:
                return <DashboardPage setPage={setPage} setSelectedDocId={setSelectedDocId} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar setPage={setPage} page={page} />
            <MainContent>
                {renderPage()}
            </MainContent>
        </div>
    );
}

// --- APP WRAPPER ---
export default function AppWrapper() {
    return (
        <AuthProvider>
            <App />
        </AuthProvider>
    );
}

