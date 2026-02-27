import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { authService } from '../api/apiClient';
import { 
  Upload, 
  ClipboardList, 
  Play, 
  BarChart3, 
  Settings, 
  Menu, 
  X,
  User,
  LogOut,
  ChevronDown,
  Home
} from 'lucide-react';
import { Button } from "../Components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../Components/ui/dropdown-menu";

export default class Layout extends Component {
  constructor(props) {
    super(props);
    this.state = {
      user: null,
      sidebarOpen: false
    };
  }

  async componentDidMount() {
    try {
      const currentUser = await authService.me();
      this.setState({ user: currentUser });
    } catch (error) {}
  }

  render() {
    const { children, currentPageName } = this.props;
    const { user, sidebarOpen } = this.state;

    const navigation = [
      { name: 'Home', href: createPageUrl('Home'), icon: Home, roles: ['admin', 'user'] },
      { name: 'Upload Video', href: createPageUrl('UploadVideo'), icon: Upload, roles: ['admin', 'user'] },
      { name: 'Video Editor', href: createPageUrl('VideoEditor'), icon: Play, roles: ['admin', 'user'] },
      { name: 'Analyst Dashboard', href: createPageUrl('AnalystDashboard'), icon: BarChart3, roles: ['admin', 'user'] },
      { name: 'Admin', href: createPageUrl('Admin'), icon: Settings, roles: ['admin'] },
    ];

    const filteredNavigation = navigation.filter(item => 
      !user?.role || item.roles.includes(user.role)
    );

    return (
      <div className="min-h-screen bg-slate-50">
        <style>{`
          :root {
            --primary: 222.2 47.4% 11.2%;
            --primary-foreground: 210 40% 98%;
            --accent: 142.1 76.2% 36.3%;
          }
        `}</style>
        
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => this.setState({ sidebarOpen: false })}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}>
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-lg">glob</span>
            </div>
            <button 
              className="lg:hidden p-1 hover:bg-slate-800 rounded"
              onClick={() => this.setState({ sidebarOpen: false })}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="px-3 py-4 space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = currentPageName === item.name.replace(/\s/g, '');
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => this.setState({ sidebarOpen: false })}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section at bottom */}
          {user && (
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors">
                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                      <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => authService.logout()}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="lg:pl-64">
          {/* Top bar */}
          <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8">
            <button 
              className="lg:hidden p-2 -ml-2 hover:bg-slate-100 rounded-lg"
              onClick={() => this.setState({ sidebarOpen: true })}
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="ml-2 lg:ml-0 text-lg font-semibold text-slate-900">
              {currentPageName?.replace(/([A-Z])/g, ' $1').trim()}
            </h1>
          </header>

          {/* Page content */}
          <main className="p-4 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    );
  }
}