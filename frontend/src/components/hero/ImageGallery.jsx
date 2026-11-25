import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const GALLERY_IMAGES = [
  { id: 1, src: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&h=350&fit=crop', alt: 'Team collaboration', category: 'Project Management', span: 'col-span-1 row-span-1' },
  { id: 2, src: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=500&h=700&fit=crop', alt: 'Developer coding', category: 'Web Development', span: 'col-span-1 row-span-2' },
  { id: 3, src: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=500&h=350&fit=crop', alt: 'Remote workspace', category: 'Virtual Assistance', span: 'col-span-1 row-span-1' },
  { id: 4, src: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=500&h=350&fit=crop', alt: 'Code review session', category: 'Software & Application Development', span: 'col-span-1 row-span-1' },
  { id: 5, src: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=500&h=350&fit=crop', alt: 'Client meeting', category: 'Business Consulting', span: 'col-span-1 row-span-1' },
  { id: 6, src: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&h=700&fit=crop', alt: 'Laptop with code', category: 'Mobile App Development', span: 'col-span-1 row-span-2' },
  { id: 7, src: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&h=350&fit=crop', alt: 'Programming screen', category: 'Data Science & Analytics', span: 'col-span-1 row-span-1' },
  { id: 8, src: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=500&h=350&fit=crop', alt: 'Team brainstorming', category: 'Product Design', span: 'col-span-1 row-span-1' },
];

function ScrollingRow({ images, direction = 'left', speed = 55 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false });

  const totalWidth = images.length * 268;
  const duration = (totalWidth / speed) * 1.5;

  return (
    <div ref={ref} className="overflow-hidden">
      <motion.div
        className="flex gap-4"
        animate={isInView ? {
          x: direction === 'left' ? [0, -totalWidth] : [-totalWidth, 0],
        } : {}}
        transition={{
          x: { duration, repeat: Infinity, repeatType: 'loop', ease: 'linear' },
        }}
        style={{ willChange: 'transform' }}
      >
        {[...images, ...images, ...images].map((img, i) => (
          <motion.div
            key={`${img.id}-${i}`}
            className="flex-shrink-0 w-[240px] h-[150px] rounded-xl overflow-hidden relative group cursor-pointer shadow-lg shadow-black/20 ring-1 ring-inset ring-white/10 transition-shadow duration-300 hover:shadow-2xl hover:shadow-primary-900/30 hover:ring-primary-400/40"
            whileHover={{ scale: 1.04, y: -6 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-2.5 pt-9">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-primary-400 to-secondary-400" />
                {img.category}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export default function ImageGallery() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="relative overflow-hidden bg-gray-50 py-14 dark:bg-dark-800">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-gray-50 to-transparent dark:from-dark-800 sm:w-32" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-gray-50 to-transparent dark:from-dark-800 sm:w-32" aria-hidden="true" />

          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <ScrollingRow images={GALLERY_IMAGES} direction="left" speed={55} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
