import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

export default function ConceptGraph({ stats }) {
  const [mounted, setMounted] = useState(false);
  const [unlockedNodes, setUnlockedNodes] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);

  const topicPerformance = stats?.topicPerformance || [];

  // Map backend stats to graph nodes
  const nodes = topicPerformance.map((t, i) => {
    const angle = (i / topicPerformance.length) * 2 * Math.PI;
    const radius = 35; // % from center
    return {
      id: t.topic.toLowerCase().replace(/\s+/g, '-'),
      label: t.topic,
      mastery: t.accuracy,
      level: t.accuracy >= 80 ? 'strong' : t.accuracy >= 60 ? 'medium' : 'weak',
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
      unlocked: t.accuracy > 0
    };
  });

  const edges = nodes.slice(0, -1).map((n, i) => ({
    from: n.id,
    to: nodes[i + 1].id
  }));

  const LEVEL_COLORS = {
    strong: {
      color: '#22C55E', // Green
      glow: 'rgba(34,197,94,0.4)',
      icon: <CheckCircle2 size={20} className="text-[#22C55E]" />,
      bg: 'bg-green-50',
    },
    medium: {
      color: '#3B82F6', // Blue
      glow: 'rgba(59,130,246,0.4)',
      icon: <BookOpen size={20} className="text-[#3B82F6]" />,
      bg: 'bg-blue-50',
    },
    weak: {
      color: '#EF4444', // Red
      glow: 'rgba(239,68,68,0.4)',
      icon: <AlertCircle size={20} className="text-[#EF4444]" />,
      bg: 'bg-red-50',
    }
  };

  useEffect(() => {
    setMounted(true);
    // Sequence the unlock animation
    const baseUnlocked = nodes.filter(n => n.unlocked).map(n => n.id);
    const timeoutIds = [];
    
    baseUnlocked.forEach((id, index) => {
      const tid = setTimeout(() => {
        setUnlockedNodes(prev => Array.from(new Set([...prev, id])));
      }, 400 + index * 400); 
      timeoutIds.push(tid);
    });

    return () => timeoutIds.forEach(clearTimeout);
  }, [stats]);

  if (!mounted) return null;

  return (
    <div className="relative w-full h-[400px] bg-[#F8FAFC] border-2 border-[#E2E8F0] shadow-sm rounded-3xl overflow-hidden p-6">
      {/* Background SVG for edges */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        <defs>
          <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>
        </defs>
        {edges.map((edge, i) => {
          const fromNode = nodes.find(n => n.id === edge.from);
          const toNode = nodes.find(n => n.id === edge.to);
          
          if (!fromNode || !toNode) return null;
          
          const isUnlocked = unlockedNodes.includes(edge.from) && unlockedNodes.includes(edge.to);
          
          return (
            <motion.line
              key={`${edge.from}-${edge.to}`}
              x1={`${fromNode.x}%`}
              y1={`${fromNode.y}%`}
              x2={`${toNode.x}%`}
              y2={`${toNode.y}%`}
              stroke="url(#edgeGradient)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={isUnlocked ? "0" : "8,8"}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ 
                pathLength: isUnlocked ? 1 : 0.4, 
                opacity: isUnlocked ? 0.8 : 0.2 
              }}
              transition={{ duration: 1.2, delay: i * 0.15, ease: "easeOut" }}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {nodes.map((node) => {
        const isUnlocked = unlockedNodes.includes(node.id);
        const isHovered = hoveredNode === node.id;
        const styleInfo = LEVEL_COLORS[node.level];
        
        // Circular progress values
        const radius = 34;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (node.mastery / 100) * circumference;

        return (
          <motion.div
            key={node.id}
            className="absolute flex flex-col items-center justify-center -ml-12 -mt-12 w-24 z-10 cursor-pointer"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: isUnlocked ? 1 : 0.9, 
              opacity: isUnlocked ? 1 : 0.4,
              y: isHovered && isUnlocked ? -8 : 0
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onMouseEnter={() => isUnlocked && setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            {/* Outer Progress Ring and Node Body */}
            <div className="relative w-[76px] h-[76px] flex items-center justify-center">
              {/* Unlock Glow Effect */}
              <AnimatePresence>
                {isUnlocked && (
                   <motion.div
                     initial={{ opacity: 0, scale: 0.5 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="absolute inset-0 rounded-full"
                     style={{ boxShadow: `0 0 25px ${styleInfo.glow}` }}
                   />
                )}
              </AnimatePresence>

              {/* Progress Ring SVG */}
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                <circle
                  cx="38"
                  cy="38"
                  r={radius}
                  stroke="#E2E8F0"
                  strokeWidth="6"
                  fill="none"
                />
                {isUnlocked && (
                   <motion.circle
                     cx="38"
                     cy="38"
                     r={radius}
                     stroke={styleInfo.color}
                     strokeWidth="6"
                     strokeLinecap="round"
                     fill="none"
                     initial={{ strokeDashoffset: circumference }}
                     animate={{ strokeDashoffset }}
                     transition={{ duration: 1.5, delay: 0.2, ease: "easeOut" }}
                     strokeDasharray={circumference}
                   />
                )}
              </svg>

              {/* Inner Node Core */}
              <motion.div
                whileHover={isUnlocked ? { scale: 1.1 } : {}}
                className={`w-[54px] h-[54px] rounded-full flex items-center justify-center bg-white shadow-md z-10 ${isUnlocked ? 'border-2' : 'border-2 border-dashed border-slate-300'}`}
                style={{ borderColor: isUnlocked ? styleInfo.color : undefined }}
              >
                {!isUnlocked ? (
                  <Lock size={20} className="text-slate-400" />
                ) : (
                  <motion.div 
                    initial={{ rotate: -180, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                  >
                    {styleInfo.icon}
                  </motion.div>
                )}
              </motion.div>
            </div>

            {/* Mastery Tag & Label */}
            <div className="mt-3 flex flex-col items-center">
              <h3 className={`font-black text-[10px] text-center px-3 py-1 rounded-full whitespace-nowrap shadow-sm border ${isUnlocked ? 'bg-white border-[#E2E8F0] text-[#0F172A]' : 'bg-slate-100 border-transparent text-slate-400'}`}>
                {node.label}
              </h3>
              
              <AnimatePresence>
                {isUnlocked && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <span 
                      className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${styleInfo.bg}`}
                      style={{ color: styleInfo.color }}
                    >
                      {node.mastery}% Mastery
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
          </motion.div>
        );
      })}
    </div>
  );
}

