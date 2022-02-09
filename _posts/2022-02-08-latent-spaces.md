# Latent spaces

Here is (probably) the most common representation of a continuous latent space: 

![cvae_latent_space](https://user-images.githubusercontent.com/61164329/153097963-7aa24954-b3c9-40d6-8b1e-0bad141acb7e.jpeg)

[source](https://www.tensorflow.org/tutorials/generative/cvae)

The interpolating figures give us hints about how the neural network learns the MNIST dataset. We see that a considerable portion of the space is reserved to round figures (0s and 9s). These figures "effortlessly" interpolate into numbers like 6 and 8. Perhaps one of the most interesting features is how 9, 8, 5, and 0 get squished into a row of 1s at the bottom.

This aspect of grouping the numbers based on their shapes constitutes one of the "insights" the latent space might carry. Let's say that our data points are $$x \in \mathbb{R}^n$$, and the latent representation is $$z \in \mathbb{R}^m$$. Here $$m < n$$, because the whole idea is to represent data with less number of features. 

I find this as one of the most striking analogies between artificial and natural neural networks. When we look at a handwritten digit, we don't go through the dataset of every single handwritten digit we've ever seen in our minds, rather, we refer to a certain "feel" of it. As a person with a slight case of [prosopagnosia ](https://www.bbc.com/news/stories-53192821) (face blindness), I would say that I am simply unable to create such a feel for most faces. I cannot create a latent space--I am forever stuck with trying to remember particularities (trying to refer to the big data), and a smallest change, a makeup, a mask, a haircut can throw everything off easily.  




