import React, { createContext, useContext, useState } from 'react';

type MenuContextType = {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  filesPageOpen: boolean;
  setFilesPageOpen: (open: boolean) => void;
};

const MenuContext = createContext<MenuContextType>({
  menuOpen: false,
  setMenuOpen: () => {},
  filesPageOpen: false,
  setFilesPageOpen: () => {},
});

export const MenuProvider = ({ children }: { children: React.ReactNode }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filesPageOpen, setFilesPageOpen] = useState(false);
  return (
    <MenuContext.Provider value={{ menuOpen, setMenuOpen, filesPageOpen, setFilesPageOpen }}>
      {children}
    </MenuContext.Provider>
  );
};

export const useMenu = () => useContext(MenuContext);
