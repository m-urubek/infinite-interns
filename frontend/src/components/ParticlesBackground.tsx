import { useEffect, useState, useMemo } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { ISourceOptions } from '@tsparticles/engine';

export function ParticlesBackground() {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  const options: ISourceOptions = useMemo(() => ({
    fullScreen: {
      enable: true,
      zIndex: -1,
    },
    background: {
      color: {
        value: 'transparent',
      },
    },
    fpsLimit: 60,
    interactivity: {
      events: {
        onHover: {
          enable: true,
          mode: 'grab',
        },
        onClick: {
          enable: true,
          mode: 'push',
        },
      },
      modes: {
        grab: {
          distance: 140,
          links: {
            opacity: 0.5,
            color: '#22d3d8',
          },
        },
        push: {
          quantity: 2,
        },
      },
    },
    particles: {
      color: {
        value: ['#ff6b9d', '#c084fc', '#22d3d8', '#a78bfa', '#f0abfc'],
      },
      links: {
        color: '#c084fc',
        distance: 150,
        enable: true,
        opacity: 0.15,
        width: 1,
        triangles: {
          enable: true,
          opacity: 0.02,
        },
      },
      move: {
        enable: true,
        speed: 0.2,
        direction: 'none' as const,
        random: true,
        straight: false,
        outModes: {
          default: 'bounce' as const,
        },
        attract: {
          enable: true,
          rotate: {
            x: 600,
            y: 1200,
          },
        },
      },
      number: {
        density: {
          enable: true,
          width: 1920,
          height: 1080,
        },
        value: 80,
      },
      opacity: {
        value: { min: 0.2, max: 0.6 },
        animation: {
          enable: true,
          speed: 0.1,
          sync: false,
          startValue: 'random' as const,
        },
      },
      shape: {
        type: 'circle',
      },
      size: {
        value: { min: 1, max: 4 },
        animation: {
          enable: true,
          speed: 0.33,
          sync: false,
          startValue: 'random' as const,
        },
      },
      twinkle: {
        particles: {
          enable: true,
          frequency: 0.01,
          opacity: 1,
          color: {
            value: ['#ff6b9d', '#22d3d8', '#c084fc'],
          },
        },
      },
    },
    detectRetina: true,
  }), []);

  if (!init) {
    return null;
  }

  return (
    <Particles
      id="tsparticles"
      options={options}
    />
  );
}
