import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type {
  KeyboardEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewProps,
} from 'react-native';

/**
 * Keyboard handling for edge-to-edge Android (the default in RN 0.87). With edge-to-edge the
 * window is no longer resized by `adjustResize`, so the keyboard simply covers content. We
 * measure the real overlap between the keyboard and the scroll view, pad the content by that
 * much, and scroll the focused input into view.
 */

const SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/** Space kept between the focused field and the top of the keyboard. */
const REVEAL_MARGIN = 96;

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(SHOW, () => setVisible(true));
    const hide = Keyboard.addListener(HIDE, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

type RevealContextValue = { reveal: () => void };
const RevealContext = createContext<RevealContextValue>({ reveal: () => {} });

/** Called by inputs on focus so a field focused while the keyboard is open is also revealed. */
export const useRevealOnFocus = (): (() => void) =>
  useContext(RevealContext).reveal;

export function KeyboardAwareScrollView({
  children,
  contentContainerStyle,
  bottomInset,
  ...props
}: ScrollViewProps & { bottomInset: number }) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const contentRef = useRef<React.ComponentRef<typeof View>>(null);
  const frameRef = useRef<React.ComponentRef<typeof View>>(null);
  const scrollY = useRef(0);
  const viewport = useRef(0);
  const overlapRef = useRef(0);
  const [overlap, setOverlap] = useState(0);

  const reveal = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput();
    const content = contentRef.current;
    if (!input || !content || overlapRef.current <= 0) {
      return;
    }
    // Wait a frame so the added bottom padding is laid out before measuring.
    requestAnimationFrame(() => {
      input.measureLayout(
        content,
        (_x, y, _w, h) => {
          const visibleHeight = viewport.current - overlapRef.current;
          const fieldBottom = y + h + REVEAL_MARGIN;
          if (fieldBottom > scrollY.current + visibleHeight) {
            scrollRef.current?.scrollTo({
              y: fieldBottom - visibleHeight,
              animated: true,
            });
          } else if (y < scrollY.current + 16) {
            scrollRef.current?.scrollTo({
              y: Math.max(0, y - 24),
              animated: true,
            });
          }
        },
        () => {},
      );
    });
  }, []);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      frameRef.current?.measureInWindow((_x, y, _w, h) => {
        // If the OS did resize the window, the frame already ends above the keyboard -> 0.
        const value = Math.max(0, y + h - e.endCoordinates.screenY);
        overlapRef.current = value;
        setOverlap(value);
        reveal();
      });
    };
    const show = Keyboard.addListener(SHOW, onShow);
    const hide = Keyboard.addListener(HIDE, () => {
      overlapRef.current = 0;
      setOverlap(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [reveal]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
      props.onScroll?.(e);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.onScroll],
  );

  const context = useMemo(() => ({ reveal }), [reveal]);

  return (
    <RevealContext.Provider value={context}>
      <View ref={frameRef} style={styles.flex} collapsable={false}>
        <ScrollView
          ref={scrollRef}
          {...props}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={e => {
            viewport.current = e.nativeEvent.layout.height;
            props.onLayout?.(e);
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[
            contentContainerStyle,
            { paddingBottom: bottomInset + overlap },
          ]}
        >
          <View ref={contentRef} collapsable={false}>
            {children}
          </View>
        </ScrollView>
      </View>
    </RevealContext.Provider>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
