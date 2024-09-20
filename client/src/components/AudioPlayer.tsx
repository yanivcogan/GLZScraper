import React, { Component, RefObject } from 'react';
import { Button, Slider, Stack, Typography } from '@mui/material';
import AlignDir from "../services/AlignDir";

// Helper function to convert hh:mm:ss to seconds
const convertTimeToSeconds = (time: string): number => {
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};

interface AudioPlayerProps {
  src: string;
  startTime: string;
}

interface AudioPlayerState {
  playbackRate: number;
}

class AudioPlayer extends Component<AudioPlayerProps, AudioPlayerState> {
  private audioRef: RefObject<HTMLAudioElement>;

  constructor(props: AudioPlayerProps) {
    super(props);
    this.audioRef = React.createRef();

    // Retrieve playback rate from localStorage or default to 2.5
    const savedPlaybackRate = parseFloat(localStorage.getItem('playbackRate') || '2.5');

    this.state = {
      playbackRate: savedPlaybackRate,
    };
  }

  componentDidMount() {
    const { startTime } = this.props;
    const { playbackRate } = this.state;

    // Set playback rate and starting time on mount
    if (this.audioRef.current) {
      this.audioRef.current.playbackRate = playbackRate;
      if (startTime) {
        const startInSeconds = convertTimeToSeconds(startTime);
        this.audioRef.current.currentTime = startInSeconds;
      }
    }
  }

  componentDidUpdate(prevProps: AudioPlayerProps) {
    const { src, startTime } = this.props;

    // Reload audio if src changes
    if (prevProps.src !== src && this.audioRef.current) {
      this.audioRef.current.load();
    }

    // Adjust time if startTime changes
    if (prevProps.startTime !== startTime && this.audioRef.current) {
      const startInSeconds = convertTimeToSeconds(startTime);
      this.audioRef.current.currentTime = startInSeconds;
    }
  }

  handlePlaybackRateChange = (_: Event, newValue: number | number[]) => {
    const playbackRate = newValue as number; // Type guard for slider value

    this.setState({ playbackRate });

    if (this.audioRef.current) {
      this.audioRef.current.playbackRate = playbackRate;
    }

    // Save playback rate to localStorage
    localStorage.setItem('playbackRate', playbackRate.toString());
  };

  jumpBackward = () => {
    if (this.audioRef.current) {
      this.audioRef.current.currentTime = Math.max(
        this.audioRef.current.currentTime - 10,
        0
      );
    }
  };

  jumpForward = () => {
    if (this.audioRef.current) {
      this.audioRef.current.currentTime = Math.min(
        this.audioRef.current.currentTime + 10,
        this.audioRef.current.duration
      );
    }
  };

  render() {
    const { src } = this.props;
    const { playbackRate } = this.state;

    return (
        <div style={{width: '100%', margin: '0 auto'}}>
        <AlignDir direction={"ltr"} >
          <Stack gap={2} >
            <audio
                controls ref={this.audioRef}
                style={{width: '100%'}}
                autoPlay={true}
                onPlay={() => {
                  if (this.audioRef.current) {
                    this.audioRef.current.playbackRate = this.state.playbackRate;
                  }
                }}
            >
              <source src={src} type="audio/mpeg"/>
              Your browser does not support the audio element.
            </audio>

            <Stack direction="row" gap={2} justifyContent="space-between"
                   sx={{width: "100%", maxWidth: 300, margin: "0 auto"}}>
              <Button variant="contained" onClick={this.jumpBackward} disabled={!this.props.src.length}>
                -10s
              </Button>

              <Slider
                  value={playbackRate}
                  onChange={this.handlePlaybackRateChange}
                  aria-labelledby="playback-rate-slider"
                  step={0.1}
                  min={1}
                  max={4.0}
                  disabled={!this.props.src.length}
              />

              <Button variant="contained" onClick={this.jumpForward} disabled={!this.props.src.length}>
                +10s
              </Button>
            </Stack>
          </Stack>
        </AlignDir>
        </div>
    );
  }
}

export default AudioPlayer;
