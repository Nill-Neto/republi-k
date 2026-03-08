import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight, Menu, X, Zap, Shield, Globe, Star, Layers, Code2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnimatedGroup } from '@/components/ui/animated-group'
import { TextEffect } from '@/components/ui/text-effect'
import { cn } from '@/lib/utils'

const transitionVariants = {
    item: {
        hidden: {
            opacity: 0,
            filter: 'blur(12px)',
            y: 12,
        },
        visible: {
            opacity: 1,
            filter: 'blur(0px)',
            y: 0,
            transition: {
                type: 'spring',
                bounce: 0.3,
                duration: 1.5,
            },
        },
    },
}

export function HeroSection() {
    return (
        <>
            <HeroHeader />
            <main className="overflow-hidden">
                <section>
                    <div className="relative pt-24 md:pt-36">
                        <div className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_10%,transparent_40%,hsl(var(--primary))_100%)]"></div>
                        <div className="absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-background to-transparent"></div>
                        <div className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-background to-transparent"></div>

                        <div className="mx-auto max-w-7xl px-6">
                            <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                                <AnimatedGroup preset="fade">
                                    <Link
                                        to="#"
                                        className="hover:bg-muted bg-muted/50 group mx-auto flex w-fit items-center gap-4 rounded-full border border-border p-1 pl-4 shadow-md shadow-primary/5 transition-colors duration-300"
                                    >
                                        <span className="text-foreground text-sm">Introducing Support for AI Models</span>
                                        <span className="bg-primary text-primary-foreground block rounded-full px-2 py-0.5 text-xs">
                                            What's new <ChevronRight className="ml-1 inline h-3 w-3" />
                                        </span>
                                    </Link>
                                </AnimatedGroup>

                                <TextEffect
                                    preset="fade"
                                    per="word"
                                    as="h1"
                                    className="mt-8 text-balance text-4xl font-bold md:text-6xl lg:text-7xl text-foreground"
                                    delay={0.2}
                                >
                                    Modern Solutions for Customer Engagement
                                </TextEffect>

                                <TextEffect
                                    per="word"
                                    as="p"
                                    preset="fade"
                                    delay={0.5}
                                    className="mx-auto mt-8 max-w-2xl text-balance text-lg text-muted-foreground"
                                >
                                    Highly customizable components for building modern websites and applications that look and feel the way you mean it.
                                </TextEffect>

                                <AnimatedGroup
                                    preset="blur-slide"
                                    className="mt-12 flex flex-col items-center justify-center gap-2 md:flex-row"
                                >
                                    <div key="cta-1">
                                        <Button size="lg" className="rounded-xl px-5">
                                            <span className="text-nowrap">Start Building</span>
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div key="cta-2">
                                        <Button size="lg" variant="ghost" className="rounded-xl px-5">
                                            <span className="text-nowrap">Request a demo</span>
                                        </Button>
                                    </div>
                                </AnimatedGroup>
                            </div>
                        </div>

                        <AnimatedGroup
                            variants={transitionVariants}
                            className="relative mt-20 overflow-hidden rounded-2xl border border-border bg-background shadow-lg shadow-primary/5 sm:mx-6 lg:mx-auto lg:max-w-5xl"
                        >
                            <div key="hero-img" className="relative">
                                <img
                                    src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=2878&q=80"
                                    alt="Dashboard preview"
                                    className="w-full rounded-2xl"
                                />
                                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-border"></div>
                            </div>
                        </AnimatedGroup>
                    </div>
                </section>

                <section className="py-16 md:py-32">
                    <div className="mx-auto max-w-5xl px-6">
                        <div className="mx-auto max-w-xl text-center">
                            <span className="text-muted-foreground font-medium">Meet Our Customers</span>
                            <p className="mt-2 text-balance text-lg font-semibold text-foreground">
                                Trusted by innovative teams worldwide
                            </p>
                        </div>

                        <div className="mx-auto mt-12 flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-8 text-muted-foreground/60">
                            <Zap className="h-8 w-auto" />
                            <Shield className="h-7 w-auto" />
                            <Globe className="h-7 w-auto" />
                            <Star className="h-7 w-auto" />
                            <Layers className="h-7 w-auto" />
                            <Code2 className="h-8 w-auto" />
                            <Zap className="h-7 w-auto" />
                            <Shield className="h-8 w-auto" />
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}

const menuItems = [
    { name: 'Features', href: '#link' },
    { name: 'Solution', href: '#link' },
    { name: 'Pricing', href: '#link' },
    { name: 'About', href: '#link' },
]

const HeroHeader = () => {
    const [menuState, setMenuState] = React.useState(false)
    const [isScrolled, setIsScrolled] = React.useState(false)

    React.useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <header>
            <nav
                data-state={isScrolled ? 'scrolled' : 'top'}
                className="fixed z-50 w-full px-2 group"
            >
                <div
                    className={cn(
                        'mx-auto mt-2 max-w-7xl rounded-2xl border border-transparent bg-transparent px-6 py-3 transition-all duration-300 lg:px-12',
                        isScrolled && 'border-border bg-background/80 backdrop-blur-lg shadow-sm'
                    )}
                >
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link to="/" aria-label="Home">
                                <Logo />
                            </Link>

                            <button
                                onClick={() => setMenuState(!menuState)}
                                aria-label={menuState ? 'Close Menu' : 'Open Menu'}
                                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
                            >
                                {menuState ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </button>
                        </div>

                        {/* Desktop nav */}
                        <div className="hidden lg:flex lg:items-center lg:gap-6">
                            <ul className="flex gap-6 text-sm">
                                {menuItems.map((item) => (
                                    <li key={item.name}>
                                        <Link
                                            to={item.href}
                                            className="text-muted-foreground hover:text-foreground transition-colors duration-300"
                                        >
                                            {item.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Mobile nav */}
                        <div
                            className={cn(
                                'absolute inset-x-0 top-full mt-2 origin-top rounded-xl border border-border bg-background p-6 shadow-lg transition-all duration-300 lg:hidden',
                                menuState ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
                            )}
                        >
                            <ul className="space-y-4 text-base">
                                {menuItems.map((item) => (
                                    <li key={item.name}>
                                        <Link
                                            to={item.href}
                                            className="text-muted-foreground hover:text-foreground transition-colors block"
                                        >
                                            {item.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6">
                                <Button variant="ghost" size="sm" asChild>
                                    <Link to="/login">Login</Link>
                                </Button>
                                <Button variant="outline" size="sm" asChild>
                                    <Link to="/login">Sign Up</Link>
                                </Button>
                                <Button size="sm" asChild>
                                    <Link to="/login">Get Started</Link>
                                </Button>
                            </div>
                        </div>

                        {/* Desktop CTA */}
                        <div className="hidden lg:flex lg:items-center lg:gap-2">
                            <Button variant="ghost" size="sm" asChild>
                                <Link to="/login">Login</Link>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <Link to="/login">Sign Up</Link>
                            </Button>
                            <Button size="sm" asChild>
                                <Link to="/login">Get Started</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    )
}

const Logo = ({ className }: { className?: string }) => {
    return (
        <svg className={cn("h-7 w-auto", className)} viewBox="0 0 100 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="5" width="20" height="20" rx="4" className="fill-primary" />
            <rect x="8" y="10" width="8" height="4" rx="1" className="fill-primary-foreground" />
            <rect x="8" y="16" width="5" height="4" rx="1" className="fill-primary-foreground" />
            <text x="28" y="22" className="fill-foreground" fontFamily="system-ui" fontWeight="700" fontSize="16">Brand</text>
        </svg>
    )
}

export default HeroSection
