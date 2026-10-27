"""Original 34-second trailer score, synthesized locally; no third-party recordings."""
from pathlib import Path
import json
import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
SR = 48000
DURATION = 34.0
rng = np.random.default_rng(20261011)
mix = np.zeros((int(SR * DURATION), 2), np.float64)

def add(audio, start, gain=1.0, pan=0.0):
    p = int(start * SR)
    if p < 0:
        audio = audio[-p:]
        p = 0
    n = min(len(audio), len(mix)-p)
    if n <= 0:
        return
    if audio.ndim == 1:
        l = np.cos((pan+1)*np.pi/4)
        r = np.sin((pan+1)*np.pi/4)
        audio = np.column_stack((audio*l, audio*r))
    mix[p:p+n] += audio[:n] * gain

def hz(midi):
    return 440 * 2**((midi-69)/12)

def env(n, attack=.01, release=.1):
    e = np.ones(n)
    a = min(n, int(attack*SR))
    r = min(n, int(release*SR))
    if a:
        e[:a] *= np.linspace(0,1,a)**2
    if r:
        e[-r:] *= np.linspace(1,0,r)**2
    return e

def tone(midi, dur, flavor='bass'):
    t = np.arange(int(dur*SR))/SR
    f = hz(midi)
    if flavor == 'bass':
        s = np.sin(2*np.pi*f*t)+.22*np.sin(4*np.pi*f*t)+.08*np.sin(6*np.pi*f*t)
        e = np.exp(-2.1*t)*env(len(t),.012,.16)
    elif flavor == 'bell':
        s = np.sin(2*np.pi*f*t)*np.exp(-3.8*t)
        s += .26*np.sin(2*np.pi*f*2.005*t)*np.exp(-6*t)
        s += .1*np.sin(2*np.pi*f*3.99*t)*np.exp(-10*t)
        e = env(len(t),.007,.3)
    else:
        s = sum(np.sin(2*np.pi*f*(1+d)*t+ph) for d,ph in [(-.0021,0),(.0018,.7),(0,1.4)])/3
        s += .2*np.sin(4*np.pi*f*t)
        e = env(len(t),.7,1.0)
    return s*e

def kick():
    t=np.arange(int(.52*SR))/SR
    phase=2*np.pi*(45*t+68*.018*(1-np.exp(-t/.018)))
    return (np.sin(phase)*np.exp(-t*9)+.08*rng.normal(0,1,len(t))*np.exp(-t*90))*env(len(t),.001,.06)

def snare():
    t=np.arange(int(.25*SR))/SR
    noise=rng.normal(0,1,len(t))
    noise=signal.sosfilt(signal.butter(2,[800,8000],btype='bandpass',fs=SR,output='sos'),noise)
    return (noise*.55+np.sin(2*np.pi*180*t)*.3)*np.exp(-t*18)*env(len(t),.002,.02)

def hat():
    t=np.arange(int(.12*SR))/SR
    noise=signal.sosfilt(signal.butter(2,7500,btype='highpass',fs=SR,output='sos'),rng.normal(0,1,len(t)))
    return noise*np.exp(-t*58)*env(len(t),.001,.015)

def impact():
    t=np.arange(int(1.9*SR))/SR
    sub=np.sin(2*np.pi*(30*t+50*.03*(1-np.exp(-t/.03))))*np.exp(-t*3.7)
    noise=signal.sosfilt(signal.butter(2,1800,btype='lowpass',fs=SR,output='sos'),rng.normal(0,1,len(t)))
    return (sub*.85+noise*.5*np.exp(-t*4))*env(len(t),.002,.2)

# Slow sea / air texture beneath a D-minor ostinato.
t=np.arange(len(mix))/SR
air=signal.sosfilt(signal.butter(2,[110,1200],btype='bandpass',fs=SR,output='sos'),rng.normal(0,1,len(t)))
add(air*(.5+.3*np.sin(2*np.pi*.11*t)),0,.06)
chords=[(38,[50,57,62,65]),(34,[46,53,58,62]),(41,[53,60,65,69]),(36,[48,55,60,64])]
for start in np.arange(0,34,2):
    root,notes=chords[int(start/2)%4]
    for j,n in enumerate(notes):
        add(tone(n,2.7,'pad'),start,.075 if start<16 else .1,[-.7,-.2,.2,.7][j])

# Suspense opening, then a stronger pulse at the first build and the boss reveal.
for beat in range(68):
    start=beat*.5
    root,notes=chords[(beat//4)%4]
    if start<2.5:
        add(tone(root,1.0),start,.12)
        if beat%2==0: add(tone(notes[beat%4]+12,1.6,'bell'),start,.06,(-1)**beat*.5)
    else:
        gain=.28 if start<16 else .4
        add(tone(root,.47),start,gain)
        add(kick(),start,.6 if start>=16 else .42)
        add(hat(),start+.25,.095 if start<16 else .14,(-1)**beat*.45)
        if beat%2:
            add(snare(),start,.23 if start<16 else .35,.1)
        if start>=6:
            note=notes[beat%4]+(12 if start>=16 else 0)
            add(tone(note,.8,'bell'),start+.25,.115,(-1)**beat*.4)
        if 16<=start<27:
            add(tone(root+12,.21),start+.25,.13,-.12)

# Musical motif, D A F E, changes register as the player progresses.
for start,n in [(3,74),(4,69),(5,77),(7,76),(9,74),(10,69),(11,65),(13,76),
                (16,74),(17,81),(18,77),(19,76),(20,74),(22,77),(23,81),
                (24,86),(25,81),(26,77),(27,76),(28,74),(29,69),(30,74)]:
    a=tone(n,1.7,'bell')
    add(a,start,.14,-.25)
    add(a,start+.19,.045,.6)
    add(a,start+.38,.025,-.65)

boundaries=[0,2.5,5.5,9,12,16,21,24,27,30]
for start in boundaries:
    add(impact(),start,.5 if start in [0,16,30] else .27)
    if start>0:
        dur=.43
        tt=np.arange(int(dur*SR))/SR
        noise=signal.sosfilt(signal.butter(2,[1000,6500],btype='bandpass',fs=SR,output='sos'),rng.normal(0,1,len(tt)))
        whoosh=noise*(np.sin(np.pi*tt/dur)**2)*np.linspace(.1,1,len(tt))
        add(whoosh,start-.32,.19,-.35)
        add(whoosh[::-1],start-.12,.12,.35)

# Short rising texture into the boss drop and a clear tonic resolution at the CTA.
for end in [12,16,30]:
    tt=np.arange(int(1.3*SR))/SR
    rise=np.sin(2*np.pi*(130*tt+300*tt**2))*np.linspace(0,1,len(tt))**2
    add(rise,end-1.3,.045,.35)
for n in [38,50,57,62,65,74]:
    add(tone(n,4.0,'pad' if n<70 else 'bell'),30,.14,0 if n<50 else .35)

# Light room echoes and soft limiting; the release leaves the final title audible.
dry=mix.copy()
for delay,gain in [(.095,.085),(.19,.065),(.31,.045)]:
    off=int(delay*SR)
    mix[off:]+=dry[:-off,::-1]*gain
mix=np.tanh(mix*.8)
fade=np.minimum(np.arange(len(mix))/(SR*.015),1)*np.minimum((len(mix)-np.arange(len(mix)))/(SR*.75),1)
mix*=fade[:,None]
mix*=.88/max(np.max(np.abs(mix)),1e-9)
dest=ROOT/'remotion'/'public'/'audio'
dest.mkdir(parents=True,exist_ok=True)
wavfile.write(dest/'tidewake-original-score.wav',SR,(mix*32767).astype(np.int16))
report={'durationSeconds':DURATION,'sampleRate':SR,'channels':2,'peakDbFS':float(20*np.log10(np.max(np.abs(mix)))),
        'rmsDbFS':float(20*np.log10(np.sqrt(np.mean(mix**2)))),'composition':'Original locally synthesized D-minor cinematic electronic score with percussion, bell motif, sea texture, risers, impacts and transition whooshes. No recordings or external samples.','sceneCutsSeconds':boundaries}
(ROOT/'source'/'score-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
