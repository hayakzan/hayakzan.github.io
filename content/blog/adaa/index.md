+++
author = "Yiğit Kolat"
title = "Antiderivative Antialiasing (1)"
date = "2026-10-26"
description = "Why waveshapers alias, and how an integral fixes it"
type = "posts"
draft = false
tags = []
math = true
+++

<br>

Inspired by Jatin Chowdhury's [Practical Considerations for Antiderivative Anti-Aliasing](https://jatinchowdhury18.medium.com/practical-considerations-for-antiderivative-anti-aliasing-d5847167f510), which I highly recommend. I'm writing this post mainly to concretize my understanding, and to chase a question that kept coming up: what changes when the waveshaper is a neural network?

<br>

## The problem: distortion creates partials above Nyquist

<br>

A **waveshaper** is the simplest nonlinear effect there is. Take each sample and push it through a function:

$$
y[n] = f(x[n])
$$

With $f(x) = \tanh(x)$ you get soft saturation, with $f(x) = \text{clamp}(x, -1, 1)$ you get a hard clipper.

<br>

<div data-waveshaper-time></div>
<script src="waveshaper-time.js"></script>

<br>

The trouble is that a nonlinearity creates new partials. Push a sine at $f_0$ through $tanh$ and you get odd partials $(2k+1)f_0$ for $k = 1,2,3,...$. A hard clipper's partials decay in a way that there is meaningful energy very far up.

In continuous time that's fine. In discrete time at sample rate $f_s$, nothing above the Nyquist frequency $f_s/2$ can be represented. A partial that goes above it reflects back by the same amount, as if Nyquist were a mirror:

$$
f_{\text{alias}} = f_s - f$$

A partial at 30 kHz at $f_s = 44.1$ kHz is 7.95 kHz above Nyquist, so it lands 7.95 kHz below Nyquist, at 14.1 kHz. 
<br>

<div data-waveshaper-aliasing></div>
<script src="waveshaper-aliasing.js"></script>

<br>

### The usual fix, and why it's expensive

<br>

The textbook answer is **oversampling**: temporarily raise the sample rate by a factor $N$ (say $4\times$ or $8\times$), run the waveshaper there, then downsample for the output. Upsampling takes a lowpass filter to fill in the new samples smoothly, downsampling again needs another lowpass to remove everything above the final $f_s/2$ before samples are thrown away. In between, the partials have $N$ times more room before they fold. 

This works, but you pay for both filters and for $N$ times the waveshaping work. And for a hard clipper, even $8\times$ isn’t always enough, as you can see below.
<br>

<div data-waveshaper-oversampling></div>
<script src="waveshaper-oversampling.js"></script>

<br>

What if instead of giving the partials more room, we reduced how much of them we generate in the first place? That's the idea behind antiderivative antialiasing.

<br>

...to be continued...
