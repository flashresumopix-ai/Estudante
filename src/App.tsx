import React, { useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  Timestamp,
  getDocFromServer,
  doc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { summarizeText, extractTextFromImage } from './services/gemini';
import { cn } from './lib/utils';
import { 
  FileText, 
  Upload, 
  Download, 
  Share2, 
  LogOut, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  History,
  Trash2,
  FilePlus,
  FileUp,
  Copy,
  Twitter,
  Facebook,
  Linkedin,
  Moon,
  Sun,
  Edit3,
  Save,
  Check,
  X,
  FileJson,
  FileCode,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { QRCodeCanvas } from 'qrcode.react';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// --- Components ---

const Logo = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center gap-2", className)}>
    <div className="relative w-10 h-12 flex items-center justify-center">
      <div className="absolute inset-0 bg-brand-blue rounded-sm transform -skew-x-6"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-brand-blue to-brand-purple rounded-sm opacity-80"></div>
      <FileText className="text-white relative z-10 w-6 h-6" />
      <div className="absolute -right-2 top-2 bg-brand-purple w-4 h-8 transform skew-x-12 flex items-center justify-center">
         <div className="w-1 h-4 bg-white rounded-full"></div>
      </div>
    </div>
    <span className="text-2xl font-bold tracking-tight">
      <span className="text-brand-blue">Flash</span>
      <span className="text-brand-purple">Resumo</span>
    </span>
  </div>
);

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost', isLoading?: boolean }>(
  ({ className, variant = 'primary', isLoading, children, ...props }, ref) => {
    const variants = {
      primary: 'gradient-brand text-white shadow-lg hover:opacity-90 active:scale-95',
      secondary: 'bg-slate-800 text-white hover:bg-slate-700 active:scale-95',
      outline: 'border-2 border-brand-blue text-brand-blue hover:bg-brand-blue/5 active:scale-95',
      ghost: 'text-slate-600 hover:bg-slate-100 active:scale-95'
    };

    return (
      <button
        ref={ref}
        disabled={isLoading}
        className={cn(
          'flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // App State
  const [originalText, setOriginalText] = useState('');
  const [summary, setSummary] = useState('');
  const [currentSummaryId, setCurrentSummaryId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [fileName, setFileName] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });

    // Test Firestore connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Conexão com Firestore OK");
      } catch (error: any) {
        if (error.message?.includes('the client is offline')) {
          console.error("Erro de configuração do Firebase: Cliente offline.");
        }
      }
    };
    testConnection();

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, 'summaries'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return unsubscribe;
    }
  }, [user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const trimmedEmail = email.trim();
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err: any) {
      console.error("Erro de Autenticação:", err.code, err.message);
      
      // Tradução de erros comuns para o usuário
      switch (err.code) {
        case 'auth/operation-not-allowed':
          setError("O login por e-mail não está ativado no console do Firebase.");
          break;
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          setError("E-mail ou senha incorretos.");
          break;
        case 'auth/email-already-in-use':
          setError("Este e-mail já está sendo usado por outra conta.");
          break;
        case 'auth/weak-password':
          setError("A senha deve ter pelo menos 6 caracteres.");
          break;
        case 'auth/invalid-email':
          setError("O e-mail informado é inválido.");
          break;
        case 'auth/unauthorized-domain':
          setError("Este domínio não está autorizado no console do Firebase (Auth Settings).");
          break;
        case 'auth/too-many-requests':
          setError("Muitas tentativas malsucedidas. Tente novamente mais tarde.");
          break;
        default:
          setError("Ocorreu um erro na autenticação: " + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);
    setError(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let extractedText = '';

      if (['jpg', 'jpeg', 'png', 'webp'].includes(extension || '')) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
        });
        reader.readAsDataURL(file);
        const base64Data = await base64Promise;
        const result = await extractTextFromImage(base64Data, file.type);
        setOriginalText(result);
        return;
      }

      if (extension === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
        }
        extractedText = fullText;
      } else if (extension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (extension === 'xlsx' || extension === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        let fullText = '';
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          fullText += XLSX.utils.sheet_to_txt(sheet) + '\n';
        });
        extractedText = fullText;
      } else if (extension === 'txt') {
        extractedText = await file.text();
      } else {
        throw new Error('Formato de arquivo não suportado. Use PDF, Word, Excel ou TXT.');
      }

      setOriginalText(extractedText);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!originalText) return;
    setIsSummarizing(true);
    setError(null);
    try {
      const result = await summarizeText(originalText);
      setSummary(result);
      setEditedSummary(result);
      
      if (user) {
        const docRef = await addDoc(collection(db, 'summaries'), {
          userId: user.uid,
          originalText,
          summaryText: result,
          fileName: fileName || 'Texto Colado',
          createdAt: Timestamp.now()
        });
        setCurrentSummaryId(docRef.id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleUpdateSummary = async () => {
    if (!user) {
      setSummary(editedSummary);
      setIsEditing(false);
      return;
    }

    if (!currentSummaryId) {
      // Se não tem ID mas o usuário está logado, talvez queira salvar como novo
      try {
        setIsLoading(true);
        const docRef = await addDoc(collection(db, 'summaries'), {
          userId: user.uid,
          originalText,
          summaryText: editedSummary,
          fileName: fileName || 'Texto Editado',
          createdAt: Timestamp.now()
        });
        setCurrentSummaryId(docRef.id);
        setSummary(editedSummary);
        setIsEditing(false);
      } catch (err: any) {
        setError("Erro ao salvar novo resumo: " + err.message);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'summaries', currentSummaryId), {
        summaryText: editedSummary
      });
      setSummary(editedSummary);
      setIsEditing(false);
    } catch (err: any) {
      console.error("Erro ao atualizar resumo:", err);
      setError("Erro ao salvar: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSummary = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'summaries', id));
      if (currentSummaryId === id) {
        setSummary('');
        setOriginalText('');
        setCurrentSummaryId(null);
      }
      setDeletingId(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const exportSummary = async (format: 'txt' | 'pdf' | 'doc') => {
    const content = isEditing ? editedSummary : summary;
    const name = `resumo_${fileName || 'texto'}`;

    if (format === 'txt') {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      const splitText = doc.splitTextToSize(content, 180);
      doc.text(splitText, 15, 15);
      doc.save(`${name}.pdf`);
    } else if (format === 'doc') {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun(content),
              ],
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${name}.docx`);
    }
  };

  const shareOnSocial = (platform: 'twitter' | 'facebook' | 'linkedin') => {
    const text = encodeURIComponent(`Confira este resumo que gerei no FlashResumo: ${summary.substring(0, 100)}...`);
    const url = encodeURIComponent(window.location.href);
    
    const links = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
    };
    
    window.open(links[platform], '_blank');
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-brand-blue animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4 transition-colors duration-300",
        darkMode ? "bg-slate-950" : "bg-slate-50"
      )}>
        <div className="absolute top-4 right-4">
          <Button variant="ghost" onClick={() => setDarkMode(!darkMode)} className="p-2">
            {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-500" />}
          </Button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-8 rounded-3xl shadow-2xl w-full max-w-md border transition-colors duration-300",
            darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
          )}
        >
          <div className="flex flex-col items-center mb-8">
            <Logo className="mb-4" />
            <h1 className={cn("text-2xl font-bold", darkMode ? "text-slate-100" : "text-slate-800")}>
              {authMode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h1>
            <p className="text-slate-500 text-center mt-2">
              {authMode === 'login' 
                ? 'Entre para resumir seus documentos instantaneamente.' 
                : 'Junte-se a nós e simplifique sua leitura.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className={cn("block text-sm font-medium mb-1", darkMode ? "text-slate-300" : "text-slate-700")}>E-mail</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border outline-none transition-all",
                  darkMode 
                    ? "bg-slate-800 border-slate-700 text-slate-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20" 
                    : "bg-white border-slate-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                )}
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className={cn("block text-sm font-medium mb-1", darkMode ? "text-slate-300" : "text-slate-700")}>Senha</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border outline-none transition-all",
                  darkMode 
                    ? "bg-slate-800 border-slate-700 text-slate-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20" 
                    : "bg-white border-slate-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                )}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full py-4 text-lg" isLoading={isLoading}>
              {authMode === 'login' ? 'Entrar' : 'Cadastrar'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-brand-blue font-medium hover:underline"
            >
              {authMode === 'login' ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen flex flex-col transition-colors duration-300",
      darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      {/* Header */}
      <header className={cn(
        "border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50 transition-colors duration-300",
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      )}>
        <Logo />
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setDarkMode(!darkMode)} className="p-2">
            {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-500" />}
          </Button>
          <Button variant="ghost" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-5 h-5" />
            <span className="hidden sm:inline">Histórico</span>
          </Button>
          <div className={cn("h-8 w-px mx-2 hidden sm:block", darkMode ? "bg-slate-800" : "bg-slate-200")}></div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className={cn("text-sm font-medium", darkMode ? "text-slate-200" : "text-slate-900")}>{user.email}</p>
            </div>
            <Button variant="ghost" onClick={() => signOut(auth)} className="p-2">
              <LogOut className="w-5 h-5 text-slate-500" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <section className="flex flex-col gap-4">
          <div className={cn(
            "rounded-3xl shadow-sm border p-6 flex-1 flex flex-col transition-colors duration-300",
            darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn("text-xl font-bold flex items-center gap-2", darkMode ? "text-slate-100" : "text-slate-800")}>
                <FileUp className="w-5 h-5 text-brand-blue" />
                Original
              </h2>
              <div className="flex gap-2">
                <label className="cursor-pointer">
                  <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.xls,.txt,image/*" onChange={handleFileUpload} />
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-blue/10 text-brand-blue rounded-lg text-sm font-medium hover:bg-brand-blue/20 transition-all">
                    <Upload className="w-4 h-4" />
                    Upload
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} />
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-purple/10 text-brand-purple rounded-lg text-sm font-medium hover:bg-brand-purple/20 transition-all">
                    <Camera className="w-4 h-4" />
                    Câmera
                  </div>
                </label>
                <Button variant="ghost" className="p-1.5" onClick={() => { setOriginalText(''); setFileName(''); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <textarea
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              placeholder="Cole seu texto aqui ou faça upload de um arquivo..."
              className={cn(
                "flex-1 w-full p-4 rounded-2xl border outline-none resize-none leading-relaxed transition-all",
                darkMode 
                  ? "bg-slate-800 border-slate-700 text-slate-200 focus:ring-brand-blue/20" 
                  : "bg-slate-50 border-slate-100 text-slate-700 focus:ring-brand-blue/10"
              )}
            />

            {fileName && (
              <div className="mt-4 p-3 bg-brand-blue/5 rounded-xl flex items-center gap-3 text-brand-blue text-sm">
                <FileText className="w-4 h-4" />
                <span className="font-medium truncate">{fileName}</span>
                <CheckCircle2 className="w-4 h-4 ml-auto" />
              </div>
            )}

            <Button 
              className="mt-6 py-4 text-lg" 
              onClick={handleSummarize} 
              isLoading={isSummarizing}
              disabled={!originalText || isSummarizing}
            >
              Gerar Resumo Inteligente
            </Button>
          </div>
        </section>

        {/* Output Section */}
        <section className="flex flex-col gap-4">
          <div className={cn(
            "rounded-3xl shadow-sm border p-6 flex-1 flex flex-col relative overflow-hidden transition-colors duration-300",
            darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn("text-xl font-bold flex items-center gap-2", darkMode ? "text-slate-100" : "text-slate-800")}>
                <CheckCircle2 className="w-5 h-5 text-brand-purple" />
                Resumo
              </h2>
              <div className="flex gap-2">
                {summary && !isEditing && (
                  <Button variant="ghost" className="p-1.5" onClick={() => { setIsEditing(true); setEditedSummary(summary); }}>
                    <Edit3 className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" className="p-1.5" onClick={() => navigator.clipboard.writeText(isEditing ? editedSummary : summary)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className={cn(
              "flex-1 w-full p-4 rounded-2xl border overflow-y-auto prose max-w-none transition-all",
              darkMode 
                ? "bg-slate-800 border-slate-700 prose-invert" 
                : "bg-slate-50 border-slate-100 prose-slate"
            )}>
              {isSummarizing ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-brand-purple" />
                  <p className="animate-pulse">Analisando e resumindo...</p>
                </div>
              ) : isEditing ? (
                <textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  className="w-full h-full bg-transparent border-none outline-none resize-none text-inherit leading-relaxed"
                  autoFocus
                />
              ) : summary ? (
                <ReactMarkdown>{summary}</ReactMarkdown>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-8">
                  <FilePlus className="w-12 h-12 mb-4 opacity-20" />
                  <p>O resumo aparecerá aqui após o processamento.</p>
                </div>
              )}
            </div>

            {isEditing && (
              <div className="mt-4 flex gap-3">
                <Button onClick={handleUpdateSummary} className="flex-1" isLoading={isLoading}>
                  <Save className="w-4 h-4" />
                  Salvar Alterações
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="px-4">
                  <X className="w-4 h-4" />
                  Cancelar
                </Button>
              </div>
            )}

            {summary && !isEditing && (
              <div className={cn(
                "mt-6 p-4 rounded-2xl border text-sm text-center",
                darkMode ? "bg-slate-800/50 border-slate-700 text-slate-300" : "bg-brand-blue/5 border-brand-blue/10 text-slate-600"
              )}>
                Este app é totalmente Gratuito, ajude-nos a continuar esse projeto, faça uma Doação. <br />
                <span className="font-bold text-brand-blue">Chave Pix: flashresumopix@gmail.com</span>
              </div>
            )}

            {summary && !isEditing && (
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex gap-2 mr-auto">
                  <Button variant="outline" onClick={() => exportSummary('txt')} className="text-sm px-3">
                    <FileText className="w-4 h-4" />
                    TXT
                  </Button>
                  <Button variant="outline" onClick={() => exportSummary('pdf')} className="text-sm px-3">
                    <FileCode className="w-4 h-4" />
                    PDF
                  </Button>
                  <Button variant="outline" onClick={() => exportSummary('doc')} className="text-sm px-3">
                    <FileJson className="w-4 h-4" />
                    DOC
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="p-2" onClick={() => shareOnSocial('twitter')}>
                    <Twitter className="w-5 h-5 text-sky-500" />
                  </Button>
                  <Button variant="ghost" className="p-2" onClick={() => shareOnSocial('facebook')}>
                    <Facebook className="w-5 h-5 text-blue-600" />
                  </Button>
                  <Button variant="ghost" className="p-2" onClick={() => shareOnSocial('linkedin')}>
                    <Linkedin className="w-5 h-5 text-blue-700" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className={cn(
                "fixed right-0 top-0 bottom-0 w-full max-w-md shadow-2xl z-[70] p-6 flex flex-col transition-colors duration-300",
                darkMode ? "bg-slate-900" : "bg-white"
              )}
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className={cn("text-2xl font-bold flex items-center gap-2", darkMode ? "text-slate-100" : "text-slate-800")}>
                  <History className="w-6 h-6 text-brand-blue" />
                  Histórico
                </h2>
                <Button variant="ghost" onClick={() => setShowHistory(false)}>Fechar</Button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {history.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Nenhum resumo salvo ainda.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id}
                      className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer group relative",
                        darkMode 
                          ? "bg-slate-800 border-slate-700 hover:border-brand-blue/50" 
                          : "bg-white border-slate-100 hover:border-brand-blue/30 hover:bg-brand-blue/5"
                      )}
                      onClick={() => {
                        setOriginalText(item.originalText);
                        setSummary(item.summaryText);
                        setEditedSummary(item.summaryText);
                        setFileName(item.fileName);
                        setCurrentSummaryId(item.id);
                        setShowHistory(false);
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-brand-blue uppercase tracking-wider">
                          {item.createdAt?.toDate().toLocaleDateString()}
                        </span>
                        <div className="flex gap-2">
                          {deletingId === item.id ? (
                            <div className="flex gap-1 items-center bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg border border-red-200 dark:border-red-800 animate-in fade-in slide-in-from-right-2">
                              <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">Apagar?</span>
                              <Button 
                                variant="ghost" 
                                className="p-1 h-auto text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSummary(item.id);
                                }}
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                className="p-1 h-auto text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingId(null);
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              variant="ghost" 
                              className="p-1 h-auto text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingId(item.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          <FileText className="w-4 h-4 text-slate-300 group-hover:text-brand-blue" />
                        </div>
                      </div>
                      <h3 className={cn("font-bold truncate", darkMode ? "text-slate-100" : "text-slate-800")}>{item.fileName}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2 mt-1">
                        {item.summaryText}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className={cn(
        "border-t p-4 text-center text-slate-400 text-sm transition-colors duration-300",
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      )}>
        &copy; 2026 FlashResumo - Resumos inteligentes em segundos.
      </footer>
    </div>
  );
}
