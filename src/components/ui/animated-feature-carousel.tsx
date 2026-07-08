"use client"
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react"
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  type MotionStyle,
  type MotionValue,
  type Variants,
} from "framer-motion"

// --- Helper ---
const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(" ")

// --- Types ---
type StaticImageData = string
type WrapperStyle = MotionStyle & {
  "--x": MotionValue<string>
  "--y": MotionValue<string>
}
interface CardProps {
  bgClass?: string
}
interface ImageSet {
  step1img1: StaticImageData
  step1img2: StaticImageData
  step2img1: StaticImageData
  step2img2: StaticImageData
  step3img1: StaticImageData
  step3img2: StaticImageData
  step4img1: StaticImageData
  step4img2: StaticImageData
  alt: string
}
interface FeatureCarouselProps extends CardProps {
  step1img1Class?: string
  step1img2Class?: string
  step2img1Class?: string
  step2img2Class?: string
  step3img1Class?: string
  step3img2Class?: string
  step4img1Class?: string
  step4img2Class?: string
  image: ImageSet
}
interface StepImageProps {
  src: StaticImageData
  alt: string
  className?: string
  style?: React.CSSProperties
  width?: number
  height?: number
}
interface Step {
  id: string
  name: string
  title: string
  description: string
}

// --- Constants ---
// Retitled from the generic demo to HERA's own four-measure assessment workflow.
const TOTAL_STEPS = 4
// The carousel explains the LOGIC behind each assessment (why it exists and what
// it contributes to the risk model), rather than restating the measure definitions
// shown in the framework grid.
const steps: readonly Step[] = [
  {
    id: "1",
    name: "Environment",
    title: "Why environmental stress?",
    description:
      "Risk begins with the hazard. HERA reads the climate load acting on the fabric, temperature, humidity and solar radiation, pulled live for the building's exact coordinates. This same baseline is what the IPCC climate scenarios later shift to project the future.",
  },
  {
    id: "2",
    name: "Condition",
    title: "Why building condition?",
    description:
      "The same climate harms a sound building far less than a failing one. Condition captures how vulnerable the fabric already is, decay, cracking, surface loss and biological growth, so identical hazards translate into very different risk.",
  },
  {
    id: "3",
    name: "Occupancy",
    title: "Why occupancy impact?",
    description:
      "Adaptive reuse adds exposure. Putting a heritage building back into service brings visitors, loading and events, an operational pressure that compounds climate and condition risk rather than sitting apart from it.",
  },
  {
    id: "4",
    name: "Future HRI",
    title: "How it becomes one index",
    description:
      "Hazard, vulnerability and exposure combine into a single Heritage Risk Index (0.40 ESS + 0.40 BCS + 0.20 OIS), then project forward under IPCC pathways to a Future HRI and a prioritized, source-grounded conservation plan.",
  },
]

const ANIMATION_PRESETS = {
  fadeInScale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { type: "spring", stiffness: 300, damping: 25, mass: 0.5 },
  },
  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { type: "spring", stiffness: 300, damping: 25, mass: 0.5 },
  },
  slideInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { type: "spring", stiffness: 300, damping: 25, mass: 0.5 },
  },
} as const
type AnimationPreset = keyof typeof ANIMATION_PRESETS
interface AnimatedStepImageProps extends StepImageProps {
  preset?: AnimationPreset
  delay?: number
  onAnimationComplete?: () => void
}

// --- Hooks ---
function useNumberCycler(totalSteps: number = TOTAL_STEPS, interval: number = 5000) {
  const [currentNumber, setCurrentNumber] = useState(0)
  useEffect(() => {
    const timerId = setTimeout(() => {
      setCurrentNumber((prev) => (prev + 1) % totalSteps)
    }, interval)
    return () => clearTimeout(timerId)
  }, [currentNumber, totalSteps, interval])
  const setStep = useCallback(
    (stepIndex: number) => {
      setCurrentNumber(stepIndex % totalSteps)
    },
    [totalSteps]
  )
  return { currentNumber, setStep }
}
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches)
    }
    checkDevice()
    window.addEventListener("resize", checkDevice)
    return () => window.removeEventListener("resize", checkDevice)
  }, [])
  return isMobile
}

// --- Components ---
function IconCheck({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={cn("h-4 w-4", className)} {...props}>
      <path d="m229.66 77.66-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32Z" />
    </svg>
  )
}
const stepVariants: Variants = {
  inactive: { scale: 0.9, opacity: 0.7 },
  active: { scale: 1, opacity: 1 },
}
const StepImage = forwardRef<HTMLImageElement, StepImageProps>(
  ({ src, alt, className, style, ...props }, ref) => {
    return (
      <img
        ref={ref}
        alt={alt}
        className={className}
        src={src}
        style={{ position: "absolute", userSelect: "none", maxWidth: "unset", ...style }}
        // No online placeholder fallback, a failed image simply hides itself.
        onError={(e) => { e.currentTarget.style.display = "none" }}
        {...props}
      />
    )
  }
)
StepImage.displayName = "StepImage"
const MotionStepImage = motion(StepImage)
const AnimatedStepImage = ({ preset = "fadeInScale", delay = 0, ...props }: AnimatedStepImageProps) => {
  const presetConfig = ANIMATION_PRESETS[preset]
  return <MotionStepImage {...props} {...presetConfig} transition={{ ...presetConfig.transition, delay }} />
}

function FeatureCard({ children, step }: { children: React.ReactNode; step: number }) {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const isMobile = useIsMobile()
  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
    if (isMobile) return
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }
  return (
    <motion.div
      className="animated-cards group relative w-full rounded-2xl"
      onMouseMove={handleMouseMove}
      style={{ "--x": useMotionTemplate`${mouseX}px`, "--y": useMotionTemplate`${mouseY}px` } as WrapperStyle}
    >
      <div className="relative w-full overflow-hidden rounded-3xl border border-[#DBC9AC] bg-[#FBF6EC] transition-colors duration-300">
        <div className="grid items-center gap-6 p-6 sm:p-9 md:grid-cols-2 md:gap-9">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="flex w-full flex-col gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="text-sm font-bold uppercase tracking-wider text-[#9A4620]"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                Step {steps[step].id} · {steps[step].name}
              </motion.div>
              <motion.h2
                className="text-2xl font-semibold tracking-tight text-[#2B2119] md:text-3xl"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {steps[step].title}
              </motion.h2>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-base leading-relaxed text-[#4A3D30]">
                  {steps[step].description}
                </p>
              </motion.div>
            </motion.div>
          </AnimatePresence>
          <div className="relative w-full">{children}</div>
        </div>
      </div>
    </motion.div>
  )
}

function StepsNav({ steps: stepItems, current, onChange }: { steps: readonly Step[]; current: number; onChange: (index: number) => void }) {
  return (
    <nav aria-label="Progress" className="flex justify-center px-4">
      <ol className="flex w-full flex-wrap items-center justify-center gap-2" role="list">
        {stepItems.map((step, stepIdx) => {
          const isCompleted = current > stepIdx
          const isCurrent = current === stepIdx
          return (
            <motion.li key={step.name} initial="inactive" animate={isCurrent ? "active" : "inactive"} variants={stepVariants} transition={{ duration: 0.3 }} className="relative">
              <button
                type="button"
                className={cn(
                  "group flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#B0532A]",
                  isCurrent
                    ? "bg-[#B0532A] text-white"
                    : "bg-[#F1E7D6] text-[#4A3D30] hover:bg-[#E6D8C0]"
                )}
                onClick={() => onChange(stepIdx)}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                    isCompleted
                      ? "bg-[#B0532A] text-white"
                      : isCurrent
                        ? "bg-white/30 text-white"
                        : "bg-[#E6D8C0] text-[#4A3D30] group-hover:bg-[#DBC9AC]"
                  )}
                >
                  {isCompleted ? <IconCheck className="h-3.5 w-3.5" /> : <span>{stepIdx + 1}</span>}
                </span>
                <span className="hidden sm:inline-block">{step.name}</span>
              </button>
            </motion.li>
          )
        })}
      </ol>
    </nav>
  )
}

export function FeatureCarousel({ image, ...props }: FeatureCarouselProps) {
  const { currentNumber: step, setStep } = useNumberCycler()
  // Two reference photos per step, shown fully (object-cover, no clipping/overlap).
  const stepImages: [StaticImageData, StaticImageData][] = [
    [image.step1img1, image.step1img2],
    [image.step2img1, image.step2img2],
    [image.step3img1, image.step3img2],
    [image.step4img1, image.step4img2],
  ]
  const renderStepContent = () => {
    const pair = stepImages[step] || stepImages[0]
    return (
      <div className="flex flex-col gap-3.5">
        {pair.map((src, i) => (
          <motion.img
            key={src + i}
            src={src}
            alt={image.alt}
            initial={{ opacity: 0, x: i === 0 ? -18 : 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 + i * 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            onError={(e) => { e.currentTarget.style.display = "none" }}
            className="w-full h-40 sm:h-44 object-cover rounded-xl border border-[#DBC9AC] shadow-xl shadow-black/10"
          />
        ))}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto p-0">
      <FeatureCard {...props} step={step}>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="w-full">
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </FeatureCard>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <StepsNav current={step} onChange={setStep} steps={steps} />
      </motion.div>
    </div>
  )
}
