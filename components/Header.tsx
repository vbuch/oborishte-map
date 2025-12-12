export default function Header() {
  return (
    <>
      {/* Top Header - Dark Blue */}
      <header className="bg-[#2c3e50] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Bar with Contact Info */}
          <div className="flex justify-between items-center py-2 text-sm">
            <div className="flex-1"></div>
            <div className="flex gap-4">
              <span>02 943 18 40 ----------- 088 247 11 79 ------</span>
              <span>Телефон /централа/ -------- При бедствия и аварии:08-17ч</span>
            </div>
          </div>

          {/* Main Header with Logo */}
          <div className="flex items-center py-4">
            <div className="flex items-center gap-4">
              {/* Logo placeholder - you can replace with actual logo */}
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center">
                <span className="text-[#2c3e50] font-bold text-xs text-center">СО<br/>Оборище</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">Район Оборище</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Bar - Light Blue */}
      <nav className="bg-[#5DADE2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6 py-3">
            <a href="/" className="text-white hover:text-gray-200 text-sm font-medium">
              ЗА НАС
            </a>
            <a href="/" className="text-white hover:text-gray-200 text-sm font-medium">
              УСЛУГИ
            </a>
            <a href="/" className="text-white hover:text-gray-200 text-sm font-medium">
              ОБРАЗОВАНИЕ
            </a>
            <a href="/" className="text-white hover:text-gray-200 text-sm font-medium">
              КУЛТУРА
            </a>
            <a href="/" className="text-white hover:text-gray-200 text-sm font-medium">
              СИГНАЛИ
            </a>
            <a href="/" className="text-white hover:text-gray-200 text-sm font-medium">
              ИЗБОРИ
            </a>
            <a href="/" className="text-white hover:text-gray-200 text-sm font-medium">
              АНТИКОРУПЦИЯ
            </a>
            <a href="/" className="text-white hover:text-gray-200 text-sm font-medium">
              ДОСТЪП ДО ОИ
            </a>
            <a href="/" className="text-white hover:text-gray-200 text-sm font-medium">
              СМЕТОСЪБИРАНЕ
            </a>
          </div>
        </div>
      </nav>
    </>
  );
}
