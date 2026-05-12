import { createContext, useContext, useMemo, useState } from 'react'
import { load, save } from '../utils/storage'

const LANGUAGE_KEY = 'siteLanguage'

export const LANGUAGES = {
  ZH: 'zh',
  EN: 'en',
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const storedLanguage = load(LANGUAGE_KEY, LANGUAGES.ZH)
    return storedLanguage === LANGUAGES.EN ? LANGUAGES.EN : LANGUAGES.ZH
  })

  function setLanguage(nextLanguage) {
    const normalizedLanguage = nextLanguage === LANGUAGES.EN ? LANGUAGES.EN : LANGUAGES.ZH
    save(LANGUAGE_KEY, normalizedLanguage)
    setLanguageState(normalizedLanguage)
  }

  const value = useMemo(() => ({
    language,
    isEnglish: language === LANGUAGES.EN,
    setLanguage,
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider')
  }
  return context
}