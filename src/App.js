import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './Components/Layout';
import Admin from './Pages/Admin';
import Home from './Pages/Home';
import UploadVideo from './Pages/UploadVideo';
import VideoEditor from './Pages/VideoEditor';
import AnalystDashboard from './Pages/AnalystDashboard';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

const queryClient = new QueryClient();

/*const lightTheme = createTheme({
  palette: {
    mode: 'light',
    background: { default: '#F8FAFC', paper: '#FFFFFF' },
    primary: { main: '#10B981', contrastText: '#ffffff' },
    secondary: { main: '#3B82F6' },
    text: { primary: '#111827', secondary: '#4B5563' },
    error: { main: '#EF4444' },
    success: { main: '#10B981' },
  },
  typography: {
    fontFamily: '"Inter", "Outfit", sans-serif',
    h4: { fontWeight: 600, letterSpacing: '-0.02em', color: '#111827' },
    h6: { fontWeight: 600, color: '#1F2937' },
    button: { textTransform: 'none', fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
  },
  components: {
    MuiCard: { styleOverrides: { root: { boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E5E7EB', borderRadius: 16 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, boxShadow: 'none', padding: '10px 24px', fontSize: '0.95rem' },
        contained: { boxShadow: '0 4px 6px -1px rgba(16,185,129,0.2)', '&:hover': { boxShadow: '0 10px 15px -3px rgba(16,185,129,0.3)' } },
        outlined: { borderWidth: '2px', '&:hover': { borderWidth: '2px' } },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#FFFFFF',
            borderRadius: 8,
            '& fieldset': { borderColor: '#E5E7EB' },
            '&:hover fieldset': { borderColor: '#10B981' },
            '&.Mui-focused fieldset': { borderColor: '#10B981' },
          },
        },
      },
    },
    MuiTableCell: { styleOverrides: { root: { borderBottom: '1px solid #F3F4F6', color: '#374151' }, head: { backgroundColor: '#F9FAFB', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
});

<ThemeProvider theme={lightTheme}>
*/
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      
        <CssBaseline />
        <Layout>
          <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/pages/Home" element={<Home />} />

            <Route path="/admin" element={<Admin />} />
            <Route path="/pages/Admin" element={<Admin />} />
            
            <Route path="/upload" element={<UploadVideo />} />
            <Route path="/pages/UploadVideo" element={<UploadVideo />} />
            
            <Route path="/videoeditor" element={<VideoEditor />} />
            <Route path="/pages/VideoEditor" element={<VideoEditor />} />
            
            <Route path="/analystdashboard" element={<AnalystDashboard />} />
            <Route path="/pages/AnalystDashboard" element={<AnalystDashboard />} />
          </Routes>
        </Layout>
      
    </QueryClientProvider>
  );
}

export default App;
