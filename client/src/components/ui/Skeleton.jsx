import React from 'react';

const Skeleton = ({ className, width, height, borderRadius = '0.5rem' }) => {
  const style = {
    width: width || '100%',
    height: height || '1rem',
    borderRadius: borderRadius,
  };

  return (
    <div 
      className={`skeleton ${className || ''}`} 
      style={style}
    />
  );
};

export default Skeleton;
