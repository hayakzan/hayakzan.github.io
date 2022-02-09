# Latent spaces

Here is (probably) the most common representation of a continuous latent space: 

![cvae_latent_space](https://user-images.githubusercontent.com/61164329/153097963-7aa24954-b3c9-40d6-8b1e-0bad141acb7e.jpeg)
[source](https://www.tensorflow.org/tutorials/generative/cvae)

The interpolating figures give us hints about how the neural network learns the MNIST dataset. We see that a considerable portion of the space is reserved to round and loop-like figures (0 and 9). These figures "effortlessly" interpolate into numbers like 6 and 8. Perhaps one of the most interesting aspects is how 9, 8, 5, and 0 get squished into a row of 1s at the bottom.

$$x \in {R}^n$$
