import { type FC, useCallback, useEffect, useState, useRef } from 'react';
import { chars, defaultHeadline, headlines } from '../../data';

const Headline: FC = () => {
    const [headline, setHeadline] = useState(defaultHeadline.toUpperCase());
    const [intervalId, setIntervalId] = useState<number>(0);
    const [previousIndex, setPreviousIndex] = useState<number>(0);
    const headlineRef = useRef<HTMLHeadingElement>(null);

    const updateHeadline = useCallback(
        (target: HTMLElement) => {
            if (intervalId) {
                window.clearInterval(intervalId);
            }

            let newIndex = Math.floor(Math.random() * headlines.length);
            if (newIndex === previousIndex) {
                newIndex = (newIndex + 1) % headlines.length;
            }
            setPreviousIndex(newIndex);
            const newHeadline = headlines[newIndex].toUpperCase();
            setHeadline(newHeadline);

            let numberOfIteration = 0;
            const newIntervalId = window.setInterval(() => {
                target.innerText = newHeadline
                    .split('')
                    .map((char: string, index: number) => {
                        return index < numberOfIteration
                            ? char
                            : chars[
                                  Math.floor(Math.random() * chars.length)
                              ].toUpperCase();
                    })
                    .join('');

                if (numberOfIteration > newHeadline.length) {
                    window.clearInterval(newIntervalId);
                    setIntervalId(0);
                }

                numberOfIteration++;
            }, 100);

            setIntervalId(newIntervalId);
        },
        [intervalId, previousIndex],
    );

    useEffect(() => {
        const mainIntervalId = window.setInterval(() => {
            if (headlineRef.current) {
                updateHeadline(headlineRef.current);
            }
        }, 4000);

        return () => window.clearInterval(mainIntervalId);
    }, [updateHeadline]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            if (headlineRef.current) {
                updateHeadline(headlineRef.current);
            }
        }, 1000);

        return () => window.clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="relative">
            <h1
                ref={headlineRef}
                className="headline px-2 py-4 text-center text-xl font-bold md:py-8 md:text-4xl"
            >
                {headline}
            </h1>
        </div>
    );
};

export { Headline };
