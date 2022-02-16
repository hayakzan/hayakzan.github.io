# Why squared $$L^2$$ norm over $$L^2$$ norm? [under construction]

In the Linear Algebra chapter of Goodfellow et al.'s brilliant [Deep Learning book](https://www.deeplearningbook.org/contents/linear_algebra.html), the following statement appears:

> The squared $$L^2$$ norm is more convenient to work with mathematically and computationally than the $$L^2$$ norm itself. For example, each derivative of the squared $$L^2$$ norm with respect to each element of $$\textbf{x}$$ depends only on the corresponding element of $$\textbf{x}$$, while all the derivatives of $$L^2$$ depend on the entire vector.

I wasn't quite sure about what is exactly referred here, so needed to dig in a bit. Hope this helps to some other learner looking for the same thing. 

The Euclidean norm, or $$L^2$$ norm can be expressed as follows:
$$L^2(x) = (x_1^2+x_2^2+...+x_i^2+...+x_n^2)^\frac{1}{2}.$$

The derivative of it indeed depends on the entire vector, like this:
$$\frac{d}{dx_i}L^2(x) = \frac{1}{2}(x_1^2+x_2^2+...+x_i^2+...+x_n^2)^{\frac{1}{2}-1}\cdot2x_i \\
= (x_1^2+x_2^2+...+x_i^2+...+x_n^2)^{-\frac{1}{2}}.$$
