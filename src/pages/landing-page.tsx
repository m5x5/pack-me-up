import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSolidPod } from '../components/SolidPodContext'
import { useHasQuestions } from '../hooks/useHasQuestions'
import { SolidProviderSelector } from '../components/SolidProviderSelector'

export const LandingPage = () => {
    const { isLoggedIn, webId, login } = useSolidPod()
    const [isProviderSelectorOpen, setIsProviderSelectorOpen] = useState(false)
    const hasQuestions = useHasQuestions()
    return (
        <>
            {isLoggedIn && (
                <div className="mb-6 p-4 bg-gradient-to-r from-success-50 dark:from-success-950/40 to-primary-50 dark:to-primary-950/40 border-2 border-success-300 dark:border-success-700 rounded-2xl shadow-soft animate-fade-in">
                    <p className="text-success-800 dark:text-success-300 font-semibold">
                        🎉 Logged in as: <span className="font-bold">{webId}</span>
                    </p>
                </div>
            )}
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12 animate-slide-up">
                    <h1 className="text-5xl font-bold mb-4 text-primary-900 dark:text-primary-200">
                        Smart Packing Lists, Made Simple
                    </h1>
                </div>

                <div className="mb-12">
                    <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-6">How it works</h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-primary-50 dark:from-primary-950/40 to-primary-100 dark:to-primary-900/30 p-6 rounded-2xl shadow-soft hover:shadow-glow-primary transition-all duration-300 hover:scale-105 border-2 border-primary-200 dark:border-primary-800">
                            <div className="text-3xl mb-2">✨</div>
                            <h3 className="text-xl font-bold mb-3 text-primary-900 dark:text-primary-200">1. Set up once</h3>
                            <p className="text-gray-700 dark:text-gray-300">
                                Run the quick wizard — tell us who you travel with and we'll generate a starter set of packing questions for you.
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-secondary-50 dark:from-secondary-950/40 to-secondary-100 dark:to-secondary-900/30 p-6 rounded-2xl shadow-soft hover:shadow-glow-secondary transition-all duration-300 hover:scale-105 border-2 border-secondary-200 dark:border-secondary-800">
                            <div className="text-3xl mb-2">✏️</div>
                            <h3 className="text-xl font-bold mb-3 text-secondary-900 dark:text-secondary-200">2. Fine-tune your questions</h3>
                            <p className="text-gray-700 dark:text-gray-300">
                                Add, remove, and customise questions and packing items until they perfectly match how you travel.
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-success-50 dark:from-success-950/40 to-success-100 dark:to-success-900/30 p-6 rounded-2xl shadow-soft hover:shadow-lg transition-all duration-300 hover:scale-105 border-2 border-success-200 dark:border-success-800">
                            <div className="text-3xl mb-2">📋</div>
                            <h3 className="text-xl font-bold mb-3 text-success-900 dark:text-success-200">3. Pack for every trip</h3>
                            <p className="text-gray-700 dark:text-gray-300">
                                Before each trip, answer your questions to instantly generate a personalised packing list.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="text-center space-y-4">
                    {hasQuestions ? (
                        <>
                            <Link
                                to="/view-lists"
                                className="inline-block bg-gradient-primary text-white px-8 py-4 rounded-2xl text-lg font-bold hover:scale-105 transition-all duration-200 shadow-soft hover:shadow-glow-primary"
                            >
                                📋 View Packing Lists
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link
                                to="/wizard"
                                className="inline-block bg-gradient-primary text-white px-8 py-4 rounded-2xl text-lg font-bold hover:scale-105 transition-all duration-200 shadow-soft hover:shadow-glow-primary"
                            >
                                ✨ Get Started with the Wizard
                            </Link>
                        </>
                    )}
                </div>

                <div className="mt-10 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-center text-sm text-gray-500 dark:text-gray-400">
                    <h2 className="font-semibold text-gray-600 dark:text-gray-400 inline">Own Your Data</h2>
                    {' '}— Login with your Solid Pod to store your lists in your own free personal storage you control. Your data saves locally in your browser automatically, even without an account.
                    {!isLoggedIn && (
                        <span className="block mt-1">
                            <button
                                className="font-semibold text-primary-700 dark:text-primary-300 underline hover:text-primary-900 dark:hover:text-primary-300"
                                onClick={() => setIsProviderSelectorOpen(true)}
                            >
                                Get a free Solid Pod
                            </button>
                            {' '}to sync across devices.
                        </span>
                    )}
                </div>
            </div>
            <SolidProviderSelector
                isOpen={isProviderSelectorOpen}
                onClose={() => setIsProviderSelectorOpen(false)}
                onSelect={(issuer) => login(issuer)}
            />
        </>
    )
}