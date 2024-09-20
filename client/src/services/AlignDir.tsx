import React from 'react';
import { styled } from '@mui/system';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';

// Styled component for dynamic text alignment
const TextWrapper = styled('div')<{ direction: 'ltr' | 'rtl' }>`
    /* @noflip */
    text-align: ${props => (props.direction === 'rtl' ? 'right' : 'left')};
    direction: ${props => (props.direction === 'rtl' ? 'rtl' : 'ltr')};
`;

// Cache provider for Material-UI styles with RTL support
const createCustomCache = (direction: 'ltr' | 'rtl') =>
    createCache({
        key: direction === 'rtl' ? 'muirtl' : 'mui',
        stylisPlugins: direction === 'rtl' ? [rtlPlugin] : [],
    });

interface Props {
    direction: 'ltr' | 'rtl'; // Props to determine text alignment
    children: React.ReactNode; // Props to accept children components
}

const AlignDir: React.FC<Props> = ({ direction, children }) => {
    const cache = React.useMemo(() => createCustomCache(direction), [direction]);

    return (
        <CacheProvider value={cache}>
            <TextWrapper direction={direction}>
                <span dir={direction}>
                    {children}
                </span>
            </TextWrapper>
        </CacheProvider>
    );
};

export default AlignDir;
