import { Text, keyframes } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { FC, ReactNode } from 'react';

const animationKeyframes = keyframes`
  0% { transform: scale(1) rotate(0); }
  25% { transform: scale(1.5) rotate(0); }
  50% { transform: scale(1.5) rotate(270deg); }
  75% { transform: scale(1) rotate(270deg); }
  100% { transform: scale(1) rotate(0); }
`;

const animation = `${animationKeyframes} 2s ease-in-out`;

const BigLetter: FC<{
    children: ReactNode;
}> = ({ children }) => {
    return (
        <Text
            fontSize="9xl"
            fontWeight="bold"
            width={'100%'}
            textAlign={'center'}
            as={motion.p}
            animation={animation}
            whileHover={{
                scale: 1.5,
                rotate: '360deg',
                transitionDuration: '200ms',
                transitionTimingFunction: 'ease-out',
            }}
        >
            {children}
        </Text>
    );
};

export { BigLetter };